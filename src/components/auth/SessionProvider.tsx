"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import {
  registerBffHandlers,
  type CapabilityDeniedStatus,
} from "@/lib/bffClient";
import { clearPersistedCollectionViews } from "@/components/filters/persistedViews";
import type {
  ActiveShowcase,
  AuthMode,
  Role,
  SessionView,
} from "@/lib/sessionConfig";
import UpgradePrompt from "./UpgradePrompt";

// Capability flags derived from the caller's role. This matrix mirrors the
// backend's AccessService (the backend is the source of truth — keep them in
// lockstep). See backend-documentation/openapi.yaml ("Roles & Capabilities").
export type Capabilities = {
  canWrite: boolean;
  canFilter: boolean;
  canImport: boolean;
  canBackup: boolean;
  isAdmin: boolean;
};

export function capabilitiesFor(
  role: Role,
  activeShowcase: ActiveShowcase | null = null,
  authMode: AuthMode = "secured",
): Capabilities {
  // While viewing a public showcase every caller is GUEST-scoped on the
  // backend (X-Showcase wins for authenticated users too — in BOTH backend
  // modes), so the collection capabilities collapse to the guest row: read +
  // filter only. Account-level state is deliberately untouched — isAdmin still
  // reflects the real logged-in user, so the account menu and /admin stay
  // reachable.
  if (activeShowcase) {
    return {
      canWrite: false,
      canFilter: true,
      canImport: false,
      canBackup: false,
      isAdmin: role === "admin",
    };
  }
  // An unsecured backend is a personal single-user instance: its AccessService
  // short-circuits every capability check to true, so mirror that with the
  // full collection row. isAdmin stays false — the admin area manages users
  // and roles, concepts that don't exist in this mode.
  if (authMode === "unsecured") {
    return {
      canWrite: true,
      canFilter: true,
      canImport: true,
      canBackup: true,
      isAdmin: false,
    };
  }
  return {
    // TRIAL, PAID, and ADMIN may create/update/delete their own data.
    canWrite: role === "trial" || role === "paid" || role === "admin",
    // Everyone but LAPSED may filter (guests filter the public showcase). An
    // UNKNOWN role (probe failed) is treated like LAPSED — no filtering.
    canFilter: role !== "lapsed" && role !== "unknown",
    // Import is paid-only — TRIAL is excluded (its import attempt 403s).
    canImport: role === "paid" || role === "admin",
    // Any authenticated role may back up its own data (UNKNOWN included — it
    // renders like LAPSED, which may back up).
    canBackup: role !== "guest",
    isAdmin: role === "admin",
  };
}

type SessionContextValue = Capabilities & {
  // The backend's security posture (fixed per deployment). "unsecured" means a
  // personal local instance: no accounts, full collection capabilities, and
  // the auth-only surfaces (login/account/admin/pricing) don't exist.
  authMode: AuthMode;
  // The resolved role: "guest" (anonymous), "trial", "paid", "lapsed", or "admin".
  // While an admin impersonates a user this is the TARGET's effective role.
  role: Role;
  // The logged-in account's email (the admin's while impersonating).
  email: string | null;
  isAuthenticated: boolean;
  // True while a real admin is acting as another user. The banner + Stop control
  // key off this (not isAdmin — the effective role isn't admin while acting).
  isImpersonating: boolean;
  // The impersonated user's email (for the banner), or null when not active.
  impersonatedEmail: string | null;
  // The logged-in account's plan expiry (epoch ms), or null when there's no
  // window (guest, or an admin-pinned role). Surfaced on the account page.
  accessUntil: number | null;
  // The public showcase currently being viewed (read-only), or null in the
  // home state (own collection / default showcase).
  activeShowcase: ActiveShowcase | null;
  // Select a showcase to view (slug) or return to the home state (null). On
  // success this performs a FULL navigation to "/" — server components must
  // re-render under the new cookie, and leaving via the section root avoids
  // guaranteed 404s on another collection's detail URLs. Resolves false when
  // the selection was rejected (e.g. the showcase just went dark).
  selectShowcase: (slug: string | null) => Promise<boolean>;
  // Stop impersonating: clears the act-as header server-side and restores the
  // admin's own role, then re-syncs this provider + re-renders server data.
  stopImpersonating: () => Promise<void>;
  // Optimistically flip to lapsed when a runtime 402 reveals the access window
  // has expired (e.g. mid-session), so controls disable immediately.
  markLapsed: () => void;
  // Re-read the server's view of the session (used after a silent refresh and to
  // resolve a capability denial). Resolves to the refreshed role, or null on
  // failure.
  refresh: () => Promise<Role | null>;
  // Open the upgrade prompt with an optional message.
  showUpgradePrompt: (message?: string) => void;
};

// Default used only when a component is rendered WITHOUT a provider — which in
// the running app never happens (the root layout always wraps the tree with a
// server-seeded provider). It therefore exists purely for isolated unit tests,
// where it resolves to a fully-capable account so a component renders in its
// complete (writable, filterable, importable) form by default; tests that
// exercise the guest/lapsed/trial gating wrap the component in a
// <SessionProvider> with that view.
const SessionContext = createContext<SessionContextValue>({
  authMode: "secured",
  role: "paid",
  email: null,
  isAuthenticated: true,
  isImpersonating: false,
  impersonatedEmail: null,
  accessUntil: null,
  activeShowcase: null,
  selectShowcase: async () => false,
  stopImpersonating: async () => {},
  ...capabilitiesFor("paid"),
  markLapsed: () => {},
  refresh: async () => null,
  showUpgradePrompt: () => {},
});

const DEFAULT_UPGRADE_MESSAGE =
  "Your subscription has lapsed. Upgrade to manage and filter your own collection.";

const IMPORT_UPGRADE_MESSAGE =
  "Importing is a paid feature — upgrade to import.";

// App-wide store for the auth/role session. Seeded with the browser-safe view
// the server resolved from the session cookie, so the correct capabilities are
// present on first paint. Tokens never reach this provider — only role/email.
export function SessionProvider({
  initial,
  children,
}: {
  initial: SessionView;
  children: ReactNode;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  // The backend never switches modes under a running deployment, so the
  // server-seeded value is constant for the life of the app — no state needed.
  const authMode: AuthMode = initial.authMode ?? "secured";
  const [role, setRole] = useState<Role>(initial.role);
  const [email, setEmail] = useState<string | null>(initial.email);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(
    initial.isImpersonating,
  );
  const [impersonatedEmail, setImpersonatedEmail] = useState<string | null>(
    initial.impersonatedEmail,
  );
  const [accessUntil, setAccessUntil] = useState<number | null>(
    initial.accessUntil,
  );
  const [activeShowcase, setActiveShowcase] = useState<ActiveShowcase | null>(
    initial.activeShowcase,
  );
  const [upgrade, setUpgrade] = useState<{ open: boolean; message: string }>({
    open: false,
    message: DEFAULT_UPGRADE_MESSAGE,
  });

  const markLapsed = useCallback(() => setRole("lapsed"), []);

  const showUpgradePrompt = useCallback((message?: string) => {
    setUpgrade({ open: true, message: message || DEFAULT_UPGRADE_MESSAGE });
  }, []);

  const refresh = useCallback(async (): Promise<Role | null> => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: SessionView };
      if (body.data) {
        setRole(body.data.role);
        setEmail(body.data.email);
        setIsImpersonating(body.data.isImpersonating);
        setImpersonatedEmail(body.data.impersonatedEmail);
        setAccessUntil(body.data.accessUntil ?? null);
        setActiveShowcase(body.data.activeShowcase ?? null);
        return body.data.role;
      }
    } catch {
      // leave current state on failure
    }
    return null;
  }, []);

  const selectShowcase = useCallback(
    async (slug: string | null): Promise<boolean> => {
      try {
        const res = await fetch("/api/showcase/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        if (!res.ok) return false;
      } catch {
        return false;
      }
      // The new collection has its own fields, so the previous collection's
      // persisted filters/sorts don't apply — clear them before we leave so a
      // stale custom-field condition can't be sent to the backend.
      clearPersistedCollectionViews();
      // Full navigation (not router.refresh): every server component must
      // re-render under the new cookie, and landing on the section root
      // escapes detail URLs that don't exist in the other collection.
      window.location.assign("/");
      return true;
    },
    [],
  );

  // A showcase selection that outlived its showcase: the server marked the
  // slug stale (no longer in the directory). Clear the cookie, tell the user,
  // and re-render the home state.
  const showcaseStale = activeShowcase?.stale === true;
  useEffect(() => {
    if (!showcaseStale) return;
    (async () => {
      try {
        await fetch("/api/showcase/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: null }),
        });
      } catch {
        // The BFF also clears the cookie when a data call hits the stale slug.
      }
      // Reverting to the home collection is the same context change as an
      // explicit switch — drop the stale showcase's persisted filters/sorts too.
      clearPersistedCollectionViews();
      setActiveShowcase(null);
      showToast({ message: "That showcase is no longer available." });
      router.refresh();
    })();
  }, [showcaseStale, router, showToast]);

  const stopImpersonating = useCallback(async (): Promise<void> => {
    try {
      await fetch("/api/admin/impersonate/stop", { method: "POST" });
    } catch {
      // Even if the POST fails, fall through to refresh — /me is the source of
      // truth, so re-syncing reflects the real (still-impersonating) state.
    }
    await refresh();
    // Server Components fetched the target's data with the act-as header; re-run
    // them now that the header is gone so the admin's own view re-renders.
    router.refresh();
  }, [refresh, router]);

  // Wire the BFF client's centralized auth/capability handling to this session.
  useEffect(() => {
    registerBffHandlers({
      onUnauthorized: () => {
        // The session was missing/expired server-side; drop to guest and send
        // the user to log in. An unsecured backend never returns 401 (and has
        // no login page), so this is a no-op there.
        if (authMode === "unsecured") return;
        setRole("guest");
        setEmail(null);
        router.push("/login");
      },
      onCapabilityDenied: async (
        status: CapabilityDeniedStatus,
        message: string,
      ) => {
        if (status === 402) {
          // A FILTER denial only happens to a LAPSED account — lapse in place.
          markLapsed();
          showUpgradePrompt(message);
          return;
        }
        // A 403 is any capability denial (write / import / backup / admin) — it
        // is NOT implicitly "lapsed". Re-read the authoritative role and show a
        // role-appropriate message instead of force-lapsing the session.
        const fresh = (await refresh()) ?? role;
        if (fresh === "lapsed") {
          showUpgradePrompt(message || DEFAULT_UPGRADE_MESSAGE);
        } else if (fresh === "trial") {
          // The must-fix: a TRIAL hitting an import 403 is NOT lapsed.
          showUpgradePrompt(message || IMPORT_UPGRADE_MESSAGE);
        } else {
          showUpgradePrompt(
            message || "That action isn’t available on your plan.",
          );
        }
      },
      onShowcaseGone: (message: string) => {
        // The BFF already cleared the gp_showcase cookie; sync client state,
        // tell the user, and re-render server data in the home state.
        setActiveShowcase(null);
        showToast({ message });
        router.refresh();
      },
    });
    return () => registerBffHandlers({});
  }, [authMode, router, role, refresh, markLapsed, showUpgradePrompt, showToast]);

  const value = useMemo<SessionContextValue>(
    () => ({
      authMode,
      role,
      email,
      isAuthenticated: role !== "guest",
      isImpersonating,
      impersonatedEmail,
      accessUntil,
      activeShowcase,
      selectShowcase,
      stopImpersonating,
      ...capabilitiesFor(role, activeShowcase, authMode),
      markLapsed,
      refresh,
      showUpgradePrompt,
    }),
    [
      authMode,
      role,
      email,
      isImpersonating,
      impersonatedEmail,
      accessUntil,
      activeShowcase,
      selectShowcase,
      stopImpersonating,
      markLapsed,
      refresh,
      showUpgradePrompt,
    ],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      <UpgradePrompt
        open={upgrade.open}
        message={upgrade.message}
        onClose={() => setUpgrade((u) => ({ ...u, open: false }))}
      />
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
