import { NextResponse } from "next/server";
import { sealData } from "iron-session";
import { appOrigin } from "@/lib/appOrigin";
import { getAuthMode } from "@/lib/authMode";
import { authorizationUrl, pkcePair, randomUrlToken } from "@/lib/oidc";
import {
  OAUTH_TX_COOKIE_NAME,
  OAUTH_TX_TTL_SECONDS,
  sessionOptions,
  type OAuthTransaction,
} from "@/lib/sessionConfig";

// GET /api/auth/login — starts the Keycloak OIDC authorization-code + PKCE flow.
// No password is collected in-app anymore; this 302-redirects the browser to
// Keycloak's hosted login page. The callback (GET /api/auth/callback) finishes
// the exchange and mints the session cookie.
export async function GET(request: Request) {
  // On an unsecured backend there are no accounts to log into — the token would
  // be ignored and the session would resolve to the broken "unknown" role. Refuse
  // outright (the login page is unreachable in this mode; this guards direct GETs).
  if ((await getAuthMode()) === "unsecured") {
    return NextResponse.json(
      {
        status: "error",
        message:
          "This instance runs without accounts; there is nothing to log into.",
      },
      { status: 409 },
    );
  }

  const url = new URL(request.url);
  // Derive the callback from the public origin so dev (3000) and compose (4200)
  // both work without per-env config — each origin's callback is registered on the
  // Keycloak client's redirectUris. Behind a reverse proxy the request's own origin
  // is the container's bind address, so APP_ORIGIN supplies it instead (appOrigin).
  const redirectUri = `${appOrigin(request)}/api/auth/callback`;

  // Only honor a same-origin relative returnTo (leading "/", not "//" which is a
  // protocol-relative absolute URL) to avoid an open redirect after login.
  const returnToParam = url.searchParams.get("returnTo");
  const returnTo =
    returnToParam &&
    returnToParam.startsWith("/") &&
    !returnToParam.startsWith("//")
      ? returnToParam
      : undefined;

  const { verifier, challenge } = await pkcePair();
  const state = randomUrlToken();
  const nonce = randomUrlToken();

  const tx: OAuthTransaction = { verifier, state, nonce, returnTo };
  const sealed = await sealData(tx, {
    password: sessionOptions.password as string,
    ttl: OAUTH_TX_TTL_SECONDS,
  });

  const authorizeUrl = authorizationUrl({
    redirectUri,
    state,
    codeChallenge: challenge,
    nonce,
  });

  const response = NextResponse.redirect(authorizeUrl, 302);
  response.cookies.set(OAUTH_TX_COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_TX_TTL_SECONDS,
  });
  return response;
}
