import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";
import { fetchMe } from "@/lib/authBackend";
import {
  decodeJwtClaims,
  exchangeCode,
  issuerPublic,
} from "@/lib/oidc";
import { getSession } from "@/lib/session";
import {
  ID_TOKEN_COOKIE_NAME,
  OAUTH_TX_COOKIE_NAME,
  OAUTH_TX_TTL_SECONDS,
  sessionOptions,
  type IdTokenCookie,
  type OAuthTransaction,
} from "@/lib/sessionConfig";

// GET /api/auth/callback — finishes the Keycloak OIDC login: validates the CSRF
// `state`, exchanges the code for tokens, checks the id_token, resolves the role
// via GET /v1/auth/me, and writes the same session cookie the old password login
// used. Everything downstream (serverAuth → api.ts Bearer forwarding, capability
// matrix, impersonation) is unchanged.

function loginRedirect(origin: string, error?: string): NextResponse {
  const url = new URL("/login", origin);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 302);
}

// A curated, user-facing message for the OAuth error codes Keycloak may return
// on the callback (never echo raw provider text at the user).
function friendlyError(code: string): string {
  switch (code) {
    case "access_denied":
      return "Login was cancelled.";
    default:
      return "Could not complete login. Please try again.";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const params = url.searchParams;

  const cookieStore = await cookies();

  // 1. The transaction cookie must be present (and unexpired) — without it we
  //    can't validate state or complete PKCE. Clear any remnant on the way out.
  const rawTx = cookieStore.get(OAUTH_TX_COOKIE_NAME)?.value;
  const clearTx = () => cookieStore.delete(OAUTH_TX_COOKIE_NAME);
  if (!rawTx) {
    return loginRedirect(origin, "Your login session expired. Please try again.");
  }

  let tx: OAuthTransaction;
  try {
    tx = await unsealData<OAuthTransaction>(rawTx, {
      password: sessionOptions.password as string,
      ttl: OAUTH_TX_TTL_SECONDS,
    });
  } catch {
    clearTx();
    return loginRedirect(origin, "Your login session expired. Please try again.");
  }
  if (!tx?.state) {
    clearTx();
    return loginRedirect(origin, "Your login session expired. Please try again.");
  }

  // 2. Keycloak-reported errors (?error=...) → friendly message.
  const errorCode = params.get("error");
  if (errorCode) {
    clearTx();
    return loginRedirect(origin, friendlyError(errorCode));
  }

  // 3. CSRF check — the returned state MUST equal the stashed state.
  const state = params.get("state");
  const code = params.get("code");
  if (!state || state !== tx.state || !code) {
    clearTx();
    return loginRedirect(origin, "Could not complete login. Please try again.");
  }

  // 4. Exchange the code for tokens at the internal token endpoint.
  const redirectUri = `${origin}/api/auth/callback`;
  let tokens;
  try {
    tokens = await exchangeCode({ code, redirectUri, codeVerifier: tx.verifier });
  } catch {
    clearTx();
    return loginRedirect(origin, "Could not complete login. Please try again.");
  }

  // 4b. Validate the id_token's nonce and issuer. The code came over TLS from a
  //     client-authenticated exchange, so decoding without full signature
  //     verification is acceptable here for these two checks.
  const claims = tokens.idToken ? decodeJwtClaims(tokens.idToken) : null;
  if (claims) {
    if (tx.nonce && claims.nonce !== tx.nonce) {
      clearTx();
      return loginRedirect(origin, "Could not complete login. Please try again.");
    }
    if (typeof claims.iss === "string" && claims.iss !== issuerPublic()) {
      clearTx();
      return loginRedirect(origin, "Could not complete login. Please try again.");
    }
  }

  // 5. Resolve the authoritative role + plan expiry. On a transient failure store
  //    "unknown" (session renders restricted) exactly as the old login route did —
  //    the backend still gates every endpoint by the real role.
  const me = await fetchMe(tokens.accessToken);
  const role = me?.role ?? "unknown";

  // Email comes from the token (Keycloak normalizes it to lowercase), so it
  // matches the backend's users row — never whatever the user typed.
  const email =
    typeof claims?.email === "string" ? claims.email.toLowerCase() : undefined;

  if (role === "unknown") {
    console.warn(
      `[auth] Could not resolve role for ${email ?? "caller"} from GET /v1/auth/me; ` +
        `storing role "unknown" (session will render restricted).`,
    );
  }

  // 6. Write the main session cookie (access + refresh + metadata). The id_token
  //    is NOT stored here — three Keycloak JWTs overflow the 4KB cookie limit —
  //    it goes in its own sealed cookie below for RP-initiated logout.
  const session = await getSession();
  session.accessToken = tokens.accessToken;
  session.refreshToken = tokens.refreshToken;
  session.accessTokenExpiresAt = Date.now() + tokens.expiresInMs;
  session.email = email;
  session.role = role;
  session.accessUntil = me?.accessUntil ?? undefined;
  await session.save();

  // 6b. Stash the id_token in its own sealed httpOnly cookie (see
  //     ID_TOKEN_COOKIE_NAME). Best-effort — a missing id_token just means logout
  //     falls back to a plain local session clear.
  if (tokens.idToken) {
    const idCookie: IdTokenCookie = { idToken: tokens.idToken };
    const sealedId = await sealData(idCookie, {
      password: sessionOptions.password as string,
    });
    cookieStore.set(ID_TOKEN_COOKIE_NAME, sealedId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }

  // 7. Clear the transaction cookie and land on the (validated) returnTo or home.
  clearTx();
  const dest =
    tx.returnTo && tx.returnTo.startsWith("/") && !tx.returnTo.startsWith("//")
      ? tx.returnTo
      : "/";
  return NextResponse.redirect(new URL(dest, origin), 302);
}
