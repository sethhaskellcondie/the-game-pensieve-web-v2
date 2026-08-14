// Silent token refresh (Next 16 "proxy", formerly "middleware"). The access
// token is short-lived (~15 min); the refresh token is single-use and rotated.
// Cookies can't be written during an RSC render, so we refresh here — before the
// request reaches any handler — where the response cookie can be set. Proxy runs
// on the Node runtime by default (so process.env + fetch behave like the rest of
// the server).

import { getIronSession } from "iron-session";
import { NextResponse, type NextRequest } from "next/server";
import { fetchMe } from "./lib/authBackend";
import { refreshTokens, OidcError, type OidcTokens } from "./lib/oidc";
import {
  SESSION_COOKIE_NAME,
  sessionOptions,
  type SessionData,
} from "./lib/sessionConfig";

// Refresh when the access token is expired or within this skew of expiring, so a
// request never goes out with a token about to lapse mid-flight.
const REFRESH_SKEW_MS = 60_000;

// How long a completed refresh stays replayable for the token it consumed. See
// `refreshOnce` — this is the window that covers a request the browser sent
// BEFORE the rotated cookie reached it.
const REFRESH_GRACE_MS = 60_000;

interface RefreshResult {
  tokens: OidcTokens;
  // Captured when the refresh actually returned, not when a replaying caller
  // reads it — otherwise a caller served from the grace window would push the
  // expiry up to a minute past the token's real lifetime and send a dead token.
  accessTokenExpiresAt: number;
}

// Keyed by the refresh token being SPENT (not by session): single-flight, plus a
// short replay window after it settles.
const inflightRefresh = new Map<string, Promise<RefreshResult>>();

/**
 * Refresh once per refresh token, no matter how many requests ask at the same
 * moment, and let late arrivals replay the result for `REFRESH_GRACE_MS`.
 *
 * Why this exists: the production realm sets `revokeRefreshToken: true` with
 * `refreshTokenMaxReuse: 0`, so presenting a refresh token that has already been
 * spent is not a harmless retry — Keycloak treats it as token-reuse and revokes
 * the whole user session. Two ways that happens without this:
 *
 *  1. A page load fires several `/api/*` calls at once. Every one of them enters
 *     this proxy carrying the same cookie, so every one would call the token
 *     endpoint with the same refresh token. The first wins; the rest are reuse.
 *  2. The browser had already dispatched a request before the rotated `Set-Cookie`
 *     reached it, so that request arrives with the previous token just after the
 *     refresh completed. The grace window answers it with the tokens that refresh
 *     produced instead of spending the dead one again.
 *
 * A failure is NOT cached — a transient network error must not lock the session
 * out of refreshing for a minute. Safe as module state because production runs a
 * single replica; a multi-replica deployment would need a shared cache (or a
 * non-zero `refreshTokenMaxReuse`).
 */
function refreshOnce(refreshToken: string): Promise<RefreshResult> {
  const shared = inflightRefresh.get(refreshToken);
  if (shared) return shared;

  const pending = refreshTokens(refreshToken).then((tokens) => ({
    tokens,
    accessTokenExpiresAt: Date.now() + tokens.expiresInMs,
  }));
  inflightRefresh.set(refreshToken, pending);
  pending.then(
    () => {
      const timer = setTimeout(() => inflightRefresh.delete(refreshToken), REFRESH_GRACE_MS);
      // Don't hold the process open for a cache eviction.
      timer.unref?.();
    },
    () => inflightRefresh.delete(refreshToken),
  );
  return pending;
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions,
  );

  const { refreshToken, accessTokenExpiresAt } = session;
  const needsRefresh =
    !!refreshToken &&
    (!accessTokenExpiresAt || accessTokenExpiresAt - Date.now() <= REFRESH_SKEW_MS);

  if (!needsRefresh || !refreshToken) {
    return response;
  }

  try {
    const { tokens, accessTokenExpiresAt } = await refreshOnce(refreshToken);
    session.accessToken = tokens.accessToken;
    // Keycloak rotates the refresh token — persist the fresh one for the next
    // refresh. (The id_token lives in its own cookie and needs no rotation: the
    // original remains a valid logout hint for the SSO session.)
    session.refreshToken = tokens.refreshToken;
    // Stamped when the refresh returned (see RefreshResult), not now.
    session.accessTokenExpiresAt = accessTokenExpiresAt;
    // The backend re-derives the role per request, so a long-lived session can
    // silently cross TRIAL → LAPSED. Re-read it on each refresh; only overwrite
    // when the probe gives a definitive answer (null = transient → keep prior).
    // While impersonating, pass the act-as header so the EFFECTIVE (target) role
    // is what we re-store — keeping capabilities correct across refreshes even
    // if the admin re-pinned the target's role elsewhere mid-session.
    const me = await fetchMe(tokens.accessToken, session.impersonatingUserId);
    if (me) {
      session.role = me.role;
      // Keep the plan expiry fresh too — a purchase/renewal (or lapse) moves it.
      session.accessUntil = me.accessUntil ?? undefined;
      if (session.impersonatingUserId != null) {
        if (me.impersonatedEmail) {
          session.impersonatedEmail = me.impersonatedEmail;
        } else {
          // Desync: the header was sent but the backend reports no
          // impersonation (e.g. the target was deleted). /me is the source of
          // truth — treat impersonation as off and clear it.
          session.impersonatingUserId = undefined;
          session.impersonatedEmail = undefined;
        }
      }
    }
    await session.save();

    // session.save() only writes the new sealed cookie to the RESPONSE (so the
    // browser gets it next time). But a route handler / RSC reads its token from
    // the REQUEST cookies via `cookies()`, so without this the very request that
    // triggered the refresh would still go out with the OLD (expired) token and
    // 401. Mirror the freshly-sealed cookie onto the incoming request, then
    // forward it downstream so this request's handler reads the new token.
    const sealed = response.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sealed !== undefined) {
      request.cookies.set(SESSION_COOKIE_NAME, sealed);
      const forwarded = NextResponse.next({ request });
      for (const cookie of response.cookies.getAll()) {
        forwarded.cookies.set(cookie);
      }
      return forwarded;
    }
  } catch (error) {
    // A definitive `invalid_grant` from the token endpoint (HTTP 400/401) means
    // the refresh token is truly dead — expired, revoked, or already consumed
    // (Keycloak rotation invalidates the session on reuse) — so clear the session
    // and let the user fall back to guest / re-login. Transient and network
    // failures (OidcError status 0, or any non-invalid_grant error) are left
    // alone: keep the current session rather than logging the user out on a hiccup.
    if (
      error instanceof OidcError &&
      (error.status === 400 || error.status === 401) &&
      error.oauthError === "invalid_grant"
    ) {
      session.destroy();
    }
  }

  return response;
}

// Skip static assets, Next internals, and the auth endpoints themselves (which
// manage the session directly and must not be intercepted mid-login).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.svg$|api/auth).*)",
  ],
};
