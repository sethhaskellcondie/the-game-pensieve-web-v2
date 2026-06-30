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
import {
  registerBffHandlers,
  type CapabilityDeniedStatus,
} from "@/lib/bffClient";
import type { Role, SessionView } from "@/lib/sessionConfig";
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

export function capabilitiesFor(role: Role): Capabilities {
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
  // The resolved role: "guest" (anonymous), "trial", "paid", "lapsed", or "admin".
  role: Role;
  email: string | null;
  isAuthenticated: boolean;
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
  role: "paid",
  email: null,
  isAuthenticated: true,
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
  const [role, setRole] = useState<Role>(initial.role);
  const [email, setEmail] = useState<string | null>(initial.email);
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
        return body.data.role;
      }
    } catch {
      // leave current state on failure
    }
    return null;
  }, []);

  // Wire the BFF client's centralized auth/capability handling to this session.
  useEffect(() => {
    registerBffHandlers({
      onUnauthorized: () => {
        // The session was missing/expired server-side; drop to guest and send
        // the user to log in.
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
    });
    return () => registerBffHandlers({});
  }, [router, role, refresh, markLapsed, showUpgradePrompt]);

  const value = useMemo<SessionContextValue>(
    () => ({
      role,
      email,
      isAuthenticated: role !== "guest",
      ...capabilitiesFor(role),
      markLapsed,
      refresh,
      showUpgradePrompt,
    }),
    [role, email, markLapsed, refresh, showUpgradePrompt],
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
