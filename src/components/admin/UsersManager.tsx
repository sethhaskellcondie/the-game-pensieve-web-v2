"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { useSession } from "@/components/auth/SessionProvider";
import DataTable, {
  MIN_COL,
  type ColumnDef,
} from "@/components/data-table/DataTable";
import Listbox, { type ListboxOption } from "@/components/filters/Listbox";
import type { AdminUser, BackendRole } from "@/lib/api";
import layout from "@/components/toys/ToysManager.module.css";
import ShowcaseModal from "./ShowcaseModal";
import styles from "./UsersManager.module.css";

const ROLE_VALUES: BackendRole[] = [
  "GUEST",
  "TRIAL",
  "PAID",
  "LAPSED",
  "ADMIN",
];

// The dropdown carries each role plus a sentinel for "no pin" (auto-derive).
const AUTO = "AUTO";

const ROLE_OPTIONS: ListboxOption[] = [
  { value: AUTO, label: "None" },
  ...ROLE_VALUES.map((role) => ({ value: role, label: role })),
];

async function readMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? "";
  } catch {
    return "";
  }
}

// Admin-only listing of every account with its effective role; lets an admin pin
// a role override (or clear it back to auto-derivation). It mirrors the other
// entity pages — the shared DataTable in the same page chrome — but the column
// set is fixed (no mass-edit mode, no hide/show), since these rows aren't
// user-authored records. Gated server-side by the /admin page, and again by the
// backend (403 for non-admins).
export default function UsersManager() {
  const { showToast, showSnackbar } = useToast();
  const { email: adminEmail, refresh } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The row whose impersonation request is in flight (disables its button and
  // shows a pending label). Only one can be active at a time.
  const [actingId, setActingId] = useState<number | null>(null);
  // The user whose showcase grant is being edited in the modal, or null.
  const [showcaseUser, setShowcaseUser] = useState<AdminUser | null>(null);
  // Ids whose role write is in flight. A ref (not state) because it only guards
  // against a double-submit on the same row — it never needs to re-render.
  const savingIds = useRef<Set<number>>(new Set());

  // Load the user list once on mount. Inline async + an `active` guard (the
  // codebase's data-fetch pattern) so state is only set after the awaits and
  // never on an unmounted component.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/users", { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setError((await readMessage(res)) || "Couldn't load users.");
          setLoading(false);
          return;
        }
        const body = (await res.json()) as { data?: AdminUser[] };
        if (!active) return;
        setError(null);
        setUsers(body.data ?? []);
        setLoading(false);
      } catch {
        if (active) {
          setError("Couldn't load users.");
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const changeRole = useCallback(
    async (user: AdminUser, value: string) => {
      // The Listbox can't disable itself mid-save, so guard against a second
      // change to the same row while its request is in flight.
      if (savingIds.current.has(user.id)) return;
      const roleOverride = value === AUTO ? null : (value as BackendRole);
      savingIds.current.add(user.id);
      try {
        const res = await fetch(`/api/admin/users/${user.id}/role`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleOverride }),
        });
        if (!res.ok) {
          showSnackbar({
            message:
              (await readMessage(res)) || "Couldn't update the user's role.",
            variant: "error",
          });
          return;
        }
        const body = (await res.json()) as { data?: AdminUser };
        if (body.data) {
          const updated = body.data;
          setUsers((prev) =>
            prev.map((u) => (u.id === updated.id ? updated : u)),
          );
        }
        showToast({
          message: roleOverride
            ? `Pinned ${user.email} to ${roleOverride}.`
            : `Cleared the role pin for ${user.email}.`,
          variant: "success",
        });
      } catch {
        showSnackbar({
          message: "Couldn't update the user's role.",
          variant: "error",
        });
      } finally {
        savingIds.current.delete(user.id);
      }
    },
    [showToast, showSnackbar],
  );

  // Start acting as a user: POST the impersonate endpoint, then re-sync the
  // session (so capabilities flip to the target's) and land on the home view
  // inside the target's tenant. On failure, surface the backend message.
  const impersonate = useCallback(
    async (user: AdminUser) => {
      if (actingId != null) return;
      setActingId(user.id);
      try {
        const res = await fetch("/api/admin/impersonate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        if (!res.ok) {
          showSnackbar({
            message:
              (await readMessage(res)) || `Couldn't act as ${user.email}.`,
            variant: "error",
          });
          setActingId(null);
          return;
        }
        await refresh();
        // Leave actingId set — the navigation away unmounts this manager, so we
        // never want the button to re-enable and invite a second start.
        router.push("/");
      } catch {
        showSnackbar({
          message: `Couldn't act as ${user.email}.`,
          variant: "error",
        });
        setActingId(null);
      }
    },
    [actingId, refresh, router, showSnackbar],
  );

  // Email, the effective (resolved) role chip, and the override picker. Fixed
  // for every admin — no mass-edit variants and nothing hidden — so the column
  // set never depends on UI settings the way the entity grids do.
  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        key: "email",
        label: "Email",
        width: 320,
        frozen: true,
        seam: true,
        render: (user) => user.email,
      },
      {
        key: "role",
        label: "Effective role",
        width: MIN_COL,
        clip: true,
        render: (user) => (
          <span className={styles.role} data-role={user.role}>
            {user.role}
          </span>
        ),
      },
      {
        key: "override",
        label: "Override",
        width: 180,
        clip: true,
        render: (user) => (
          <Listbox
            value={user.roleOverride ?? AUTO}
            options={ROLE_OPTIONS}
            onChange={(value) => changeRole(user, value)}
            ariaLabel={`Role override for ${user.email}`}
          />
        ),
      },
      {
        key: "showcase",
        label: "Showcase",
        width: 260,
        clip: true,
        render: (user) => {
          // The grant is only publicly listed while the owner derives to
          // PAID/ADMIN — flag the reserved-but-dark state inline.
          const dark =
            user.showcaseSlug != null &&
            user.role !== "PAID" &&
            user.role !== "ADMIN";
          return (
            <span className={styles.showcaseCell}>
              {user.showcaseSlug ? (
                <span
                  className={styles.showcaseValue}
                  title={`${user.showcaseName ?? user.showcaseSlug} (${user.showcaseSlug})${dark ? " — not publicly visible" : ""}`}
                >
                  {user.showcaseName ?? user.showcaseSlug}{" "}
                  <span className={styles.showcaseSlug}>
                    ({user.showcaseSlug})
                  </span>
                  {dark ? (
                    <span className={styles.showcaseDark}> not visible</span>
                  ) : null}
                </span>
              ) : (
                <span className={styles.showcaseNone}>—</span>
              )}
              <button
                type="button"
                className={styles.viewAs}
                onClick={() => setShowcaseUser(user)}
                aria-label={`Edit showcase for ${user.email}`}
              >
                {user.showcaseSlug ? "Edit" : "Grant"}
              </button>
            </span>
          );
        },
      },
      {
        key: "impersonate",
        label: "View as",
        width: 160,
        clip: true,
        render: (user) => {
          // Acting as yourself is a no-op — disable the admin's own row.
          const isSelf = adminEmail != null && user.email === adminEmail;
          return (
            <button
              type="button"
              className={styles.viewAs}
              onClick={() => impersonate(user)}
              disabled={isSelf || actingId != null}
              aria-label={`View as ${user.email}`}
            >
              {actingId === user.id ? "Starting…" : "View as user"}
            </button>
          );
        },
      },
    ],
    [changeRole, impersonate, actingId, adminEmail],
  );

  const showcaseSaved = useCallback(
    (updated: AdminUser) => {
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      showToast({
        message: updated.showcaseSlug
          ? `Showcase "${updated.showcaseSlug}" saved for ${updated.email}.`
          : `Cleared the showcase for ${updated.email}.`,
        variant: "success",
      });
    },
    [showToast],
  );

  return (
    <div className={layout.page}>
      <div className={layout.head}>
        <div className={layout.titleWrap}>
          <div className={layout.titleRow}>
            <h2 className={layout.entName}>
              {loading ? (
                "Loading…"
              ) : (
                <>
                  <b>{users.length}</b> {users.length === 1 ? "User" : "Users"}
                </>
              )}
            </h2>
          </div>
        </div>
      </div>

      <DataTable
        storageKey="adminUsers"
        columns={columns}
        rows={users}
        getRowKey={(user) => user.id}
        loading={loading}
        loadingMessage="Loading users…"
        emptyMessage={error ?? "No users yet."}
      />

      {showcaseUser ? (
        <ShowcaseModal
          user={showcaseUser}
          onClose={() => setShowcaseUser(null)}
          onSaved={showcaseSaved}
        />
      ) : null}
    </div>
  );
}
