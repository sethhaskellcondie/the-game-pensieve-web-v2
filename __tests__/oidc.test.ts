import {
  authorizationUrl,
  decodeJwtClaims,
  exchangeCode,
  OidcError,
  refreshTokens,
} from "@/lib/oidc";

// oidc.ts is the hand-rolled Keycloak client. The highest-risk piece is the
// `expires_in` (SECONDS on the wire) → `expiresInMs` (milliseconds) conversion,
// so pin it here along with the request shapes and error mapping.

const ORIGINAL_ENV = { ...process.env };
const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeAll(() => {
  process.env.OIDC_ISSUER = "http://localhost:8081/realms/pensieve";
  process.env.OIDC_CLIENT_ID = "pensieve-web";
  process.env.OIDC_CLIENT_SECRET = "dev-web-secret-change-me";
  delete process.env.OIDC_INTERNAL_ISSUER;
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = originalFetch;
});

afterEach(() => {
  jest.clearAllMocks();
  global.fetch = originalFetch;
});

const TOKEN_URL =
  "http://localhost:8081/realms/pensieve/protocol/openid-connect/token";

describe("exchangeCode", () => {
  it("posts an authorization_code grant with the client secret + verifier, and converts expires_in seconds → ms", async () => {
    const mockFetch = jest.fn(async () =>
      jsonResponse({
        access_token: "at",
        refresh_token: "rt",
        id_token: "it",
        token_type: "Bearer",
        expires_in: 900, // 15 minutes, in SECONDS
      }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const tokens = await exchangeCode({
      code: "the-code",
      redirectUri: "http://localhost:3000/api/auth/callback",
      codeVerifier: "the-verifier",
    });

    expect(tokens).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      idToken: "it",
      tokenType: "Bearer",
      expiresInMs: 900_000, // seconds * 1000 — NOT 900
    });

    const [url, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(TOKEN_URL);
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("client_id=pensieve-web");
    expect(body).toContain("client_secret=dev-web-secret-change-me");
    expect(body).toContain("code=the-code");
    expect(body).toContain("code_verifier=the-verifier");
  });
});

describe("refreshTokens", () => {
  it("posts a refresh_token grant and maps the rotated tokens", async () => {
    const mockFetch = jest.fn(async () =>
      jsonResponse({
        access_token: "at2",
        refresh_token: "rt2",
        id_token: "it2",
        token_type: "Bearer",
        expires_in: 300,
      }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const tokens = await refreshTokens("old-rt");
    expect(tokens.accessToken).toBe("at2");
    expect(tokens.refreshToken).toBe("rt2");
    expect(tokens.expiresInMs).toBe(300_000);

    const [, init] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=old-rt");
  });

  it("throws OidcError carrying the oauth error code on a definitive failure", async () => {
    const mockFetch = jest.fn(async () =>
      jsonResponse({ error: "invalid_grant", error_description: "Token is not active" }, 400),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(refreshTokens("dead")).rejects.toMatchObject({
      name: "OidcError",
      status: 400,
      oauthError: "invalid_grant",
    });
  });

  it("throws OidcError with status 0 (transient) on a network failure", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const err = await refreshTokens("rt").catch((e) => e);
    expect(err).toBeInstanceOf(OidcError);
    expect(err.status).toBe(0);
    expect(err.oauthError).toBeUndefined();
  });
});

describe("authorizationUrl", () => {
  it("targets the public issuer, requests scope=openid only, and uses S256 PKCE", () => {
    const url = new URL(
      authorizationUrl({
        redirectUri: "http://localhost:3000/api/auth/callback",
        state: "st",
        codeChallenge: "cc",
        nonce: "nn",
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "http://localhost:8081/realms/pensieve/protocol/openid-connect/auth",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("cc");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("nonce")).toBe("nn");
    expect(url.searchParams.get("client_id")).toBe("pensieve-web");
  });
});

describe("decodeJwtClaims", () => {
  it("decodes the payload without verifying the signature", () => {
    const payload = Buffer.from(
      JSON.stringify({ email: "Seth@Example.com", nonce: "nn" }),
    ).toString("base64url");
    const jwt = `header.${payload}.sig`;
    expect(decodeJwtClaims(jwt)).toEqual({
      email: "Seth@Example.com",
      nonce: "nn",
    });
  });

  it("returns null on a malformed token", () => {
    expect(decodeJwtClaims("not-a-jwt")).toBeNull();
  });
});
