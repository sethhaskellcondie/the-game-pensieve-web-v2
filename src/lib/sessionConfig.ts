// Session shape + iron-session options, kept free of `next/headers` and `fetch`
// so this module is safe to import anywhere — including middleware. The actual
// cookie access lives in src/lib/session.ts (server-only) and src/middleware.ts.

import type { SessionOptions } from "iron-session";

// The role the backend resolves for a caller, per request, under the `secured`
// profile. We mirror the backend's AccessService vocabulary verbatim (the
// backend is the source of truth). "guest" is the anonymous case — never stored
// in a session, just the absence of a cookie/token. "unknown" is OUR sentinel
// (not a backend role): an authenticated session whose role could not be resolved
// from `GET /v1/auth/me` (endpoint down/missing, or a transient failure). It is
// treated as the most restrictive authenticated state (capabilities mirror
// "lapsed") and surfaced plainly in the UI rather than silently masquerading as
// a fully-capable role. The backend still gates every endpoint, so an unknown
// session can never exceed its real role's permissions.
export type Role = "guest" | "trial" | "paid" | "lapsed" | "admin" | "unknown";

// A role we may actually persist for an authenticated user — everything except
// the anonymous "guest", which is represented by having no token at all.
export type StoredRole = Exclude<Role, "guest">;

// What we persist in the encrypted cookie. The browser never sees these values —
// only the BFF (server) reads/writes them. `accessTokenExpiresAt` is epoch ms,
// used by the proxy to refresh proactively before the token expires.
export type SessionData = {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  email?: string;
  role?: StoredRole;
};

// What the browser is allowed to know about the session: never the tokens.
export type SessionView = {
  role: Role;
  email: string | null;
};

// A dev-only fallback keeps the app and E2E runnable out of the box; production
// MUST override SESSION_SECRET (see .env.example). iron-session requires >= 32
// chars.
const DEV_SESSION_SECRET =
  "dev-only-insecure-session-secret-change-me-in-prod";

export const SESSION_COOKIE_NAME = "gp_session";

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || DEV_SESSION_SECRET,
  cookieName: SESSION_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};

// Derives the caller's role from raw session data. A session with no access
// token is the anonymous guest (e.g. a destroyed/empty cookie). An authenticated
// session with no stored role resolves to "unknown" — we never invent a role the
// role probe failed to confirm, so the UI fails loudly (shows UNKNOWN, renders
// restricted) instead of silently granting a fully-capable role. The backend
// still enforces the real role on every endpoint.
export function sessionRole(session: SessionData): Role {
  if (!session.accessToken) return "guest";
  return session.role ?? "unknown";
}

export function toSessionView(session: SessionData): SessionView {
  return {
    role: sessionRole(session),
    email: session.accessToken ? (session.email ?? null) : null,
  };
}
