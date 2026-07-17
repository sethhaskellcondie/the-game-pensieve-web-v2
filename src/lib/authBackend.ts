// Reads the caller's identity/role from the backend's one surviving auth
// endpoint, `GET /v1/auth/me`. Login/refresh now go through Keycloak OIDC (see
// src/lib/oidc.ts); the backend still resolves identity from the forwarded
// Bearer access token exactly as before, and /v1/auth/me reports it. This module
// deliberately does NOT go through the authed helpers in src/lib/api.ts and does
// NOT import `next/headers` — that keeps it usable from the proxy (middleware).
// See backend-documentation/openapi.yaml ("Authentication").

import { getBaseUrl } from "./apiBase";
import type { Role, StoredRole } from "./sessionConfig";

type Envelope<T> = { data: T; errors: string[] | null };

// Thrown when an authed backend call fails, carrying the backend status and
// message. Retained for callers that surface auth failures with a status.
export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// Maps the backend's uppercase role enum (GUEST/TRIAL/PAID/LAPSED/ADMIN) onto the
// stored (authenticated) roles we persist. An authenticated caller never resolves
// to GUEST, so that case folds into the safe "paid" default alongside anything
// unrecognized.
const STORED_ROLES: Record<string, StoredRole> = {
  TRIAL: "trial",
  PAID: "paid",
  LAPSED: "lapsed",
  ADMIN: "admin",
};

// The caller identity returned by `GET /v1/auth/me` (the backend's CurrentUser
// schema). While an admin acts as a user, `impersonating` describes the target
// (the effective experience); it is null on a normal request. `id` on the outer
// object is the logged-in account (the admin while impersonating).
export type CurrentUser = {
  id: number;
  email: string;
  role: Role;
  // The logged-in account's access-window expiry (epoch ms), or null for no
  // window. Describes the primary identity — the admin's while impersonating.
  accessUntil: number | null;
  impersonating: { id: number; email: string; role: Role } | null;
};

// The interpreted result of `GET /v1/auth/me`. `role` is the EFFECTIVE role to
// store/gate on — the target's while impersonating, the caller's own otherwise.
// `impersonatedEmail` is the target's email while impersonating, else null.
// `accessUntil` is the logged-in account's plan expiry (epoch ms), or null when
// there's no window (e.g. an admin-pinned role); it tracks the primary identity
// like `email`, so it's the admin's value while impersonating.
export type ResolvedMe = {
  role: StoredRole;
  impersonatedEmail: string | null;
  accessUntil: number | null;
};

function resolveRole(raw: string | undefined): StoredRole | null {
  return (raw && STORED_ROLES[raw.toUpperCase()]) || null;
}

// Reads `GET /v1/auth/me` and interprets the impersonation marker. When
// `actAsOwnerId` is supplied the act-as header is attached (so an admin sees the
// target's identity); this is how the impersonate endpoints and the proxy probe
// the effective role while acting as a user. Returns null on a transient failure
// (network error / unexpected status) so callers keep a previously-known role
// rather than guessing a more restrictive one. While impersonating, the
// effective role is the target's (defaulting to "unknown" if unrecognized —
// impersonation is still active, so we keep it on, restricted); on a normal
// request an unrecognized role yields null, exactly as before.
export async function fetchMe(
  accessToken: string,
  actAsOwnerId?: number,
): Promise<ResolvedMe | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    if (actAsOwnerId != null) {
      headers["X-Act-As-Owner"] = String(actAsOwnerId);
    }
    const res = await fetch(`${getBaseUrl()}/auth/me`, {
      method: "GET",
      cache: "no-store",
      headers,
    });
    if (!res.ok) {
      console.warn(
        `[auth] GET /v1/auth/me failed (${res.status} ${res.statusText}); ` +
          `role could not be resolved.`,
      );
      return null;
    }
    const data = ((await res.json()) as Envelope<CurrentUser>).data;
    if (!data) {
      console.warn(`[auth] GET /v1/auth/me returned no data; role could not be resolved.`);
      return null;
    }
    const accessUntil = data.accessUntil ?? null;
    if (data.impersonating) {
      // The backend confirmed an active impersonation — render as the target.
      // accessUntil stays the primary (admin's) window, matching the identity.
      return {
        role: resolveRole(data.impersonating.role) ?? "unknown",
        impersonatedEmail: data.impersonating.email,
        accessUntil,
      };
    }
    const resolved = resolveRole(data.role);
    if (!resolved) {
      console.warn(
        `[auth] GET /v1/auth/me returned an unrecognized role (${data.role ?? "none"}); ` +
          `role could not be resolved.`,
      );
      return null;
    }
    return { role: resolved, impersonatedEmail: null, accessUntil };
  } catch (error) {
    console.warn(`[auth] GET /v1/auth/me request errored; role could not be resolved.`, error);
    return null;
  }
}

// Reads the caller's authoritative effective role from `GET /v1/auth/me`.
// Returns the resolved StoredRole, or null on a transient failure (network
// error, or an unexpected status) so the caller can keep a previously-known role
// or fall back to a safe default itself — we never guess a *more* restrictive
// role from a failed probe. A thin wrapper over fetchMe for callers that only
// need the role (login; the proxy when not impersonating).
export async function fetchRole(accessToken: string): Promise<StoredRole | null> {
  return (await fetchMe(accessToken))?.role ?? null;
}
