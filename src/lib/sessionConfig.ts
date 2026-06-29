// Session shape + iron-session options, kept free of `next/headers` and `fetch`
// so this module is safe to import anywhere — including middleware. The actual
// cookie access lives in src/lib/session.ts (server-only) and src/middleware.ts.

import type { SessionOptions } from "iron-session";

// The role the backend resolves for a caller, per request, under the `secured`
// profile. We mirror the backend's AccessService vocabulary verbatim (the
// backend is the source of truth). "guest" is the anonymous case — never stored
// in a session, just the absence of a cookie/token.
export type Role = "guest" | "trial" | "paid" | "lapsed" | "admin";

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
// session with no stored role defaults to "paid" — a safe, fully-capable role so
// a transient role-probe failure never wrongly locks a user out of writes (the
// runtime 402/403 handling will still catch a genuine lapse).
export function sessionRole(session: SessionData): Role {
  if (!session.accessToken) return "guest";
  return session.role ?? "paid";
}

export function toSessionView(session: SessionData): SessionView {
  return {
    role: sessionRole(session),
    email: session.accessToken ? (session.email ?? null) : null,
  };
}
