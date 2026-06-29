"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import type { AdminUser, BackendRole } from "@/lib/api";
import styles from "./AdminUsersManager.module.css";

const ROLE_VALUES: BackendRole[] = [
  "GUEST",
  "TRIAL",
  "PAID",
  "LAPSED",
  "ADMIN",
];

// The select carries each role plus a sentinel for "no pin" (auto-derive).
const AUTO = "AUTO";

async function readMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? "";
  } catch {
    return "";
  }
}

// Admin-only table of every account with its effective role; lets an admin pin a
// role override (or clear it back to auto-derivation). Gated server-side by the
// /admin page, and again by the backend (403 for non-admins).
export default function AdminUsersManager() {
  const { showToast, showSnackbar } = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

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
          setUsers([]);
          return;
        }
        const body = (await res.json()) as { data?: AdminUser[] };
        if (!active) return;
        setError(null);
        setUsers(body.data ?? []);
      } catch {
        if (active) {
          setError("Couldn't load users.");
          setUsers([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const changeRole = async (user: AdminUser, value: string) => {
    const roleOverride = value === AUTO ? null : (value as BackendRole);
    setSavingId(user.id);
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
          (prev ?? []).map((u) => (u.id === updated.id ? updated : u)),
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
      setSavingId(null);
    }
  };

  if (error && (!users || users.length === 0)) {
    return (
      <div className={styles.panel}>
        <p className={styles.error} role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!users) {
    return (
      <div className={styles.panel}>
        <p className={styles.muted}>Loading users…</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <table className={styles.table}>
        <caption className={styles.caption}>User accounts</caption>
        <thead>
          <tr>
            <th scope="col">Email</th>
            <th scope="col">Effective role</th>
            <th scope="col">Override</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const current = user.roleOverride ?? AUTO;
            return (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>
                  <span className={styles.role} data-role={user.role}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <label className={styles.srOnly} htmlFor={`role-${user.id}`}>
                    Role override for {user.email}
                  </label>
                  <select
                    id={`role-${user.id}`}
                    className={styles.select}
                    value={current}
                    disabled={savingId === user.id}
                    onChange={(e) => changeRole(user, e.target.value)}
                  >
                    <option value={AUTO}>Auto (no pin)</option>
                    {ROLE_VALUES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
