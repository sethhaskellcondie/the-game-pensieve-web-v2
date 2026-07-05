// Silent token refresh (Next 16 "proxy", formerly "middleware"). The access
// token is short-lived (~15 min); the refresh token is single-use and rotated.
// Cookies can't be written during an RSC render, so we refresh here — before the
// request reaches any handler — where the response cookie can be set. Proxy runs
// on the Node runtime by default (so process.env + fetch behave like the rest of
// the server).

import { getIronSession } from "iron-session";
import { NextResponse, type NextRequest } from "next/server";
import { refreshBackend, fetchMe, AuthError } from "./lib/authBackend";
import {
  SESSION_COOKIE_NAME,
  sessionOptions,
  type SessionData,
} from "./lib/sessionConfig";

// Refresh when the access token is expired or within this skew of expiring, so a
// request never goes out with a token about to lapse mid-flight.
const REFRESH_SKEW_MS = 60_000;

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
    const tokens = await refreshBackend(refreshToken);
    session.accessToken = tokens.accessToken;
    session.refreshToken = tokens.refreshToken;
    session.accessTokenExpiresAt = Date.now() + tokens.expiresInMs;
    // The backend re-derives the role per request, so a long-lived session can
    // silently cross TRIAL → LAPSED. Re-read it on each refresh; only overwrite
    // when the probe gives a definitive answer (null = transient → keep prior).
    // While impersonating, pass the act-as header so the EFFECTIVE (target) role
    // is what we re-store — keeping capabilities correct across refreshes even
    // if the admin re-pinned the target's role elsewhere mid-session.
    const me = await fetchMe(tokens.accessToken, session.impersonatingUserId);
    if (me) {
      session.role = me.role;
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
    // Only an explicit 401 (invalid/expired refresh token) means the session is
    // truly dead — clear it so the user falls back to guest and is sent to login
    // on the next protected action. Transient/network failures (and the benign
    // race where a sibling request already rotated this single-use refresh token)
    // are left alone: we keep the current session and let the downstream request
    // proceed, rather than logging the user out on a hiccup.
    if (error instanceof AuthError && error.status === 401) {
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
