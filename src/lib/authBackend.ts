// Public auth client for the backend's /v1/auth/* endpoints plus the role probe.
// The register/login/refresh calls are unauthenticated (flat bodies, no bearer
// token); fetchRole is the one authed call here. This module deliberately does
// NOT go through the authed helpers in src/lib/api.ts and does NOT import
// `next/headers` — that keeps it usable from the proxy (middleware).
// See backend-documentation/openapi.yaml ("Authentication").

import { getBaseUrl } from "./apiBase";
import type { Role, StoredRole } from "./sessionConfig";

// Mirrors the AuthTokens schema. expiresInMs is the access token lifetime.
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInMs: number;
};

export type RegisteredUser = {
  id: number;
  email: string;
};

type Envelope<T> = { data: T; errors: string[] | null };

// Thrown when an auth call fails, carrying the backend status (401 bad creds /
// invalid refresh, 400 duplicate email) and the backend's error message.
export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function readErrors(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { errors?: unknown };
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      return body.errors.join(", ");
    }
  } catch {
    // ignore parse failures
  }
  return null;
}

async function postAuth<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await readErrors(res);
    throw new AuthError(
      res.status,
      detail || `Auth request failed: ${res.status} ${res.statusText} (${path})`,
    );
  }

  const payload = (await res.json()) as Envelope<T>;
  if (payload.errors && payload.errors.length > 0) {
    throw new AuthError(res.status, payload.errors.join(", "));
  }
  return payload.data;
}

export function registerBackend(
  email: string,
  password: string,
): Promise<RegisteredUser> {
  return postAuth<RegisteredUser>("/auth/register", { email, password });
}

export function loginBackend(
  email: string,
  password: string,
): Promise<AuthTokens> {
  return postAuth<AuthTokens>("/auth/login", { email, password });
}

export function refreshBackend(refreshToken: string): Promise<AuthTokens> {
  return postAuth<AuthTokens>("/auth/refresh", { refreshToken });
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

// Reads the caller's authoritative role from `GET /v1/auth/me` ({ email, role }).
// Returns the resolved StoredRole, or null on a transient failure (network error,
// unexpected status, or a backend that doesn't yet expose the endpoint) so the
// caller can keep a previously-known role or fall back to a safe default itself —
// we never guess a *more* restrictive role from a failed probe.
export async function fetchRole(accessToken: string): Promise<StoredRole | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/auth/me`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as Envelope<{ email: string; role: Role }>;
    const raw = payload.data?.role;
    return (raw && STORED_ROLES[raw.toUpperCase()]) || null;
  } catch {
    return null;
  }
}
