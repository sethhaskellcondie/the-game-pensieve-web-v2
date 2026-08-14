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

// The backend's security posture, detected from GET /heartbeat's `secureMode`
// flag (see src/lib/authMode.ts). Fixed for the lifetime of a deployment:
// "secured" enforces accounts and roles; "unsecured" is a personal, local,
// single-user instance where users/permissions/profiles do not apply — the
// caller gets full collection capabilities with no login.
export type AuthMode = "secured" | "unsecured";

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
  // The backend's security posture. Optional so the many places (mostly tests)
  // that build a view literal keep working — absent means "secured", the
  // posture every existing consumer was written against.
  authMode?: AuthMode;
};

// A dev-only fallback keeps the app and E2E runnable out of the box; production
// MUST override SESSION_SECRET (see .env.example). iron-session requires >= 32
// chars.
//
// This literal is committed, so it is public: it is in the repo, in the built
// image, and readable by anyone. It seals gp_session, which carries live
// Keycloak access AND refresh tokens — so a production instance that fell back
// to it would let anyone forge a session cookie for any account, and would look
// completely healthy while doing it. resolveSessionSecret() below is what makes
// that impossible; keep the fallback confined to it.
const DEV_SESSION_SECRET =
  "dev-only-insecure-session-secret-change-me-in-prod";

// iron-session's floor. A shorter password is refused by sealData() at runtime,
// which would surface as a login failure rather than a configuration error, so
// the length is checked up front where the message can say what is wrong.
const MIN_SESSION_SECRET_LENGTH = 32;

// The password that seals gp_session, or a hard failure. Production is
// fail-closed on purpose: a missing or too-short SESSION_SECRET throws rather
// than falling back to the committed dev secret, because that fallback is
// silent — the resulting deployment is indistinguishable from a working one
// until someone forges a cookie.
//
// Deliberately NOT evaluated at module load. `next build` runs with
// NODE_ENV=production and imports every route module while collecting page
// data, so a throw at module scope fails the image build on a machine that has
// no business holding the production secret. This is called lazily instead:
// from the `password` accessor below (so nothing can ever be sealed with the
// dev secret in production) and eagerly from instrumentation.ts at server
// startup (so a misconfigured deployment dies on boot rather than on the first
// login attempt).
//
// Outside production the fallback stands, so `npm run dev` and the Playwright
// suite need no configuration.
export function resolveSessionSecret(): string {
  const configured = process.env.SESSION_SECRET;

  if (process.env.NODE_ENV !== "production") {
    return configured || DEV_SESSION_SECRET;
  }

  if (!configured) {
    throw new Error(
      "SESSION_SECRET is required in production. It seals the session cookie " +
        "holding live access and refresh tokens; without it the app would fall " +
        "back to a secret that is public in the repository, and anyone could " +
        "forge a session for any account. Generate one with: openssl rand -base64 48",
    );
  }

  if (configured.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters ` +
        `in production (got ${configured.length}). iron-session refuses to seal ` +
        "with a shorter password, so every login would fail at runtime. " +
        "Generate one with: openssl rand -base64 48",
    );
  }

  return configured;
}

export const SESSION_COOKIE_NAME = "gp_session";

// The active-showcase cookie: a plain httpOnly cookie holding just the selected
// showcase slug. Deliberately separate from the encrypted session cookie so an
// anonymous visitor can pick a showcase without a session, and clearing it never
// touches auth state. No cookie = the "home" state. Set/cleared only by
// POST /api/showcase/select (which validates the slug against the directory).
export const SHOWCASE_COOKIE_NAME = "gp_showcase";

// The short-lived OIDC transaction cookie. It carries the in-flight login's PKCE
// verifier, CSRF `state`, id_token `nonce`, and optional post-login `returnTo`
// between the login redirect and the callback. Deliberately separate from the
// main session cookie (it is not auth state) and sealed with the same
// SESSION_SECRET via iron-session's sealData/unsealData. Set by GET
// /api/auth/login, read + cleared by GET /api/auth/callback.
export const OAUTH_TX_COOKIE_NAME = "gp_oauth";

// TTL (seconds) for the transaction cookie — long enough to complete a login at
// Keycloak's hosted page, short enough that a stale/abandoned attempt lapses.
export const OAUTH_TX_TTL_SECONDS = 600;

export type OAuthTransaction = {
  verifier: string;
  state: string;
  nonce: string;
  // A validated same-origin relative path to return to after login, or absent.
  returnTo?: string;
};

// The Keycloak id_token is kept ONLY for RP-initiated logout (`id_token_hint`).
// It lives in its own sealed httpOnly cookie rather than the main session cookie
// because three Keycloak JWTs (access + refresh + id) sealed together overflow
// the 4096-byte browser cookie limit. The access + refresh tokens (the ones the
// proxy and api.ts actually use every request) stay in gp_session; the id_token
// is written once at login and read at logout — it never needs rotating, since
// Keycloak accepts the original id_token as a logout hint for the SSO session.
export const ID_TOKEN_COOKIE_NAME = "gp_oidc";

export type IdTokenCookie = { idToken: string };

export const sessionOptions: SessionOptions = {
  // An accessor, not a value: see resolveSessionSecret() for why this must not
  // run at module load. iron-session reads it on every seal/unseal, so there is
  // no code path that can encrypt a cookie without passing the production
  // check first.
  get password(): string {
    return resolveSessionSecret();
  },
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
  authMode: AuthMode = "secured",
): SessionView {
  // An unsecured backend has no accounts: whatever the cookie holds (e.g. a
  // stale session from a secured deployment of the same URL) is ignored rather
  // than surfaced as a broken half-logged-in state. The nominal role stays
  // "guest" — matching what the backend resolves — while capabilitiesFor()
  // grants the full-capability row for this mode.
  if (authMode === "unsecured") {
    return {
      role: "guest",
      email: null,
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase,
      authMode,
    };
  }
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
    authMode,
  };
}
