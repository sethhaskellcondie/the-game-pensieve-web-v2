// Silent token refresh (Next 16 "proxy", formerly "middleware"). The access
// token is short-lived (~15 min); the refresh token is single-use and rotated.
// Cookies can't be written during an RSC render, so we refresh here — before the
// request reaches any handler — where the response cookie can be set. Proxy runs
// on the Node runtime by default (so process.env + fetch behave like the rest of
// the server).

import { getIronSession } from "iron-session";
import { NextResponse, type NextRequest } from "next/server";
import { refreshBackend, fetchRole, AuthError } from "./lib/authBackend";
import { sessionOptions, type SessionData } from "./lib/sessionConfig";

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

  if (needsRefresh && refreshToken) {
    try {
      const tokens = await refreshBackend(refreshToken);
      session.accessToken = tokens.accessToken;
      session.refreshToken = tokens.refreshToken;
      session.accessTokenExpiresAt = Date.now() + tokens.expiresInMs;
      // The backend re-derives the role per request, so a long-lived session can
      // silently cross TRIAL → LAPSED. Re-read it on each refresh; only overwrite
      // when the probe gives a definitive answer (null = transient → keep prior).
      const role = await fetchRole(tokens.accessToken);
      if (role) session.role = role;
      await session.save();
    } catch (error) {
      // An invalid/expired/already-used refresh token (401) means the session is
      // dead — clear it so the user falls back to guest and is sent to login on
      // the next protected action. Transient errors also clear; the user can log
      // back in.
      if (!(error instanceof AuthError) || error.status === 401) {
        session.destroy();
      }
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
