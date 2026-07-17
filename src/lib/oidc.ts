// Hand-rolled Keycloak OIDC client (authorization-code + PKCE). Server-only, but
// deliberately free of `next/headers` and iron-session so it can be used from the
// proxy (middleware) as well as the login/callback route handlers. Uses `fetch`
// plus Web Crypto (`crypto.subtle`, `crypto.getRandomValues`) to match this
// codebase's dependency-light style — the flow is one realm, one confidential
// client (`pensieve-web`).
//
// Public vs internal issuer split: BROWSER redirects (authorization, end-session)
// go to the PUBLIC issuer (OIDC_ISSUER, e.g. localhost:8081); SERVER token
// exchange/refresh go to the INTERNAL issuer (OIDC_INTERNAL_ISSUER, e.g.
// keycloak:8080 in compose). Tokens' `iss` is always the canonical public issuer
// regardless, so we validate id_token.iss against the public one. In host dev,
// leave OIDC_INTERNAL_ISSUER unset and both resolve to OIDC_ISSUER.

// The token endpoint's response, mapped onto our session-friendly shape. Keycloak
// returns `expires_in` in SECONDS; we convert to `expiresInMs` (milliseconds) so
// callers can compute `accessTokenExpiresAt = Date.now() + expiresInMs` exactly
// as they did with the old backend's `expiresInMs` field. Getting this unit wrong
// makes the proxy think the token lasts ~15ms (refresh every request) or never
// expires — the conversion lives here, once.
export type OidcTokens = {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  tokenType: string;
  expiresInMs: number;
};

// Thrown when a token endpoint call fails. `status` is the HTTP status;
// `oauthError` is the OAuth2 `error` code (e.g. "invalid_grant") when the body
// carried one — the proxy keys its "is this refresh token dead?" decision off it.
export class OidcError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly oauthError?: string,
  ) {
    super(message);
    this.name = "OidcError";
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required OIDC env var: ${name}`);
  }
  return value;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

// The browser-facing issuer (authorization + end-session redirects, id_token
// `iss` validation).
export function issuerPublic(): string {
  return trimSlash(requireEnv("OIDC_ISSUER"));
}

// The server-facing issuer (token exchange + refresh). Falls back to the public
// issuer when OIDC_INTERNAL_ISSUER is unset (host dev — they're the same host).
export function issuerInternal(): string {
  return trimSlash(process.env.OIDC_INTERNAL_ISSUER || issuerPublic());
}

function clientId(): string {
  return requireEnv("OIDC_CLIENT_ID");
}

function clientSecret(): string {
  return requireEnv("OIDC_CLIENT_SECRET");
}

function authorizationEndpoint(): string {
  return `${issuerPublic()}/protocol/openid-connect/auth`;
}

function tokenEndpoint(): string {
  return `${issuerInternal()}/protocol/openid-connect/token`;
}

function endSessionEndpoint(): string {
  return `${issuerPublic()}/protocol/openid-connect/logout`;
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

// A URL-safe random token (base64url of 32 random bytes) — used for the PKCE
// verifier, the CSRF `state`, and the id_token `nonce`.
export function randomUrlToken(byteLength = 32): string {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

// PKCE S256 pair: verifier = base64url(32 random bytes), challenge =
// base64url(SHA-256(ASCII(verifier))) per RFC 7636.
export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomUrlToken(32);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

// Builds the browser redirect against the PUBLIC issuer. We request
// `scope=openid` ONLY — `pensieve:read`/`email`/`profile` are default client
// scopes and attach automatically; naming a default scope explicitly makes
// Keycloak reject the request with `invalid_scope`.
export function authorizationUrl({
  redirectUri,
  state,
  codeChallenge,
  nonce,
}: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  nonce: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId(),
    redirect_uri: redirectUri,
    scope: "openid",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${authorizationEndpoint()}?${params.toString()}`;
}

type KeycloakTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function postToken(body: URLSearchParams): Promise<OidcTokens> {
  let res: Response;
  try {
    res = await fetch(tokenEndpoint(), {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
  } catch (error) {
    // Network failure — no HTTP status. Surface as status 0 so callers treat it
    // as transient (never as a dead refresh token).
    throw new OidcError(0, `OIDC token request failed: ${String(error)}`);
  }

  const json = (await res.json().catch(() => null)) as KeycloakTokenResponse | null;

  if (!res.ok || !json || !json.access_token) {
    throw new OidcError(
      res.status,
      json?.error_description ||
        json?.error ||
        `OIDC token request failed: ${res.status} ${res.statusText}`,
      json?.error,
    );
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? "",
    idToken: json.id_token,
    tokenType: json.token_type ?? "Bearer",
    // Seconds → milliseconds (see OidcTokens above).
    expiresInMs: (json.expires_in ?? 0) * 1000,
  };
}

// Exchanges an authorization code for tokens at the INTERNAL token endpoint
// (confidential client: client_id + client_secret) with the PKCE code_verifier.
export function exchangeCode({
  code,
  redirectUri,
  codeVerifier,
}: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<OidcTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
  return postToken(body);
}

// Refreshes tokens at the INTERNAL token endpoint. Keycloak rotates the refresh
// token, so callers must persist the returned refreshToken (and idToken).
export function refreshTokens(refreshToken: string): Promise<OidcTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
  });
  return postToken(body);
}

// Builds the PUBLIC RP-initiated logout URL: `id_token_hint` +
// `post_logout_redirect_uri`, so the browser can be redirected to kill the
// Keycloak SSO session (not just the local cookie).
export function endSessionUrl({
  idToken,
  postLogoutRedirectUri,
}: {
  idToken?: string;
  postLogoutRedirectUri: string;
}): string {
  const params = new URLSearchParams({
    post_logout_redirect_uri: postLogoutRedirectUri,
  });
  if (idToken) params.set("id_token_hint", idToken);
  return `${endSessionEndpoint()}?${params.toString()}`;
}

// Decodes a JWT's payload WITHOUT verifying the signature. Safe here because the
// id_token arrives over TLS from a client-authenticated code exchange; we use it
// only to read `nonce`/`iss`/`email` claims. Returns null on any parse failure.
export function decodeJwtClaims(jwt: string): Record<string, unknown> | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
