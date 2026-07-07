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
//
// `email`/`role` always describe the EFFECTIVE caller. While an admin is
// impersonating a user (acting as them via the X-Act-As-Owner header), `email`
// stays the logged-in admin's email but `role` is overwritten with the target's
// effective role, so the capability matrix automatically reflects the target.
// `impersonatingUserId` is the target's user id (sent as the act-as header on
// every backend call) and `impersonatedEmail` is the target's email (for the
// banner). Both are absent for a normal, non-impersonating session.
export type SessionData = {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  email?: string;
  role?: StoredRole;
  // The logged-in account's plan expiry (`access_until`) as epoch ms, or absent
  // for no window. Like `email` it describes the primary identity — the admin's
  // while impersonating — and is re-read from GET /v1/auth/me on every refresh.
  accessUntil?: number;
  impersonatingUserId?: number;
  impersonatedEmail?: string;
};

// The public showcase the viewer currently has selected (the `gp_showcase`
// cookie), resolved against the backend's showcase directory. `name` is the
// display title from the directory. `stale` marks a slug the directory no
// longer lists (owner lapsed / grant revoked mid-visit): the server stops
// attaching the X-Showcase header for it, and the client clears the cookie and
// tells the user the showcase is gone.
export type ActiveShowcase = {
  slug: string;
  name: string;
  stale?: boolean;
};

// What the browser is allowed to know about the session: never the tokens.
// `role` is the effective role (the target's while impersonating). `email` is
// the logged-in account (the admin's email while impersonating).
// `isImpersonating`/`impersonatedEmail` drive the impersonation banner.
// `activeShowcase` is the read-only public showcase being viewed, or null for
// the "home" state (own collection when authenticated, the default showcase
// when anonymous). It lives in its own plain cookie — not the session — so an
// anonymous visitor can select a showcase without minting a session, but it is
// surfaced through this view so first paint renders the right banner and
// capabilities.
export type SessionView = {
  role: Role;
  email: string | null;
  isImpersonating: boolean;
  impersonatedEmail: string | null;
  // The logged-in account's plan expiry (epoch ms), or null when there's no
  // window (guest, or an admin-pinned role). Drives the account page's "active
  // until" line.
  accessUntil: number | null;
  activeShowcase: ActiveShowcase | null;
};

// A dev-only fallback keeps the app and E2E runnable out of the box; production
// MUST override SESSION_SECRET (see .env.example). iron-session requires >= 32
// chars.
const DEV_SESSION_SECRET =
  "dev-only-insecure-session-secret-change-me-in-prod";

export const SESSION_COOKIE_NAME = "gp_session";

// The active-showcase cookie: a plain httpOnly cookie holding just the selected
// showcase slug. Deliberately separate from the encrypted session cookie so an
// anonymous visitor can pick a showcase without a session, and clearing it never
// touches auth state. No cookie = the "home" state. Set/cleared only by
// POST /api/showcase/select (which validates the slug against the directory).
export const SHOWCASE_COOKIE_NAME = "gp_showcase";

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

export function toSessionView(
  session: SessionData,
  activeShowcase: ActiveShowcase | null = null,
): SessionView {
  const authed = !!session.accessToken;
  // Only honor impersonation fields on an authenticated session — a stray id on
  // an anonymous/destroyed session must never read as "impersonating".
  const impersonating = authed && session.impersonatingUserId != null;
  return {
    role: sessionRole(session),
    email: authed ? (session.email ?? null) : null,
    isImpersonating: impersonating,
    impersonatedEmail: impersonating ? (session.impersonatedEmail ?? null) : null,
    accessUntil: authed ? (session.accessUntil ?? null) : null,
    activeShowcase,
  };
}
