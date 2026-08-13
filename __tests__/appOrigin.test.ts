import { appOrigin } from "@/lib/appOrigin";

// appOrigin decides the origin every browser-facing OAuth URL is built from.
// Getting it wrong is not subtle: behind the production reverse proxy the
// request's own origin is the container's bind address (0.0.0.0:3000), so the
// app asks Keycloak for a redirect_uri the realm does not register and login
// fails outright with "Invalid parameter: redirect_uri". These pin both halves —
// the configured override, and the unconfigured fallback that dev relies on.

const ORIGINAL_ENV = { ...process.env };

// The shape Next hands a Route Handler behind the proxy: the URL carries the
// bind address, while the real host only survives in headers we do not trust.
function requestFrom(url: string): Request {
  return { url } as unknown as Request;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("appOrigin", () => {
  it("falls back to the request's own origin when APP_ORIGIN is unset", () => {
    delete process.env.APP_ORIGIN;
    expect(appOrigin(requestFrom("http://localhost:3000/api/auth/login"))).toBe(
      "http://localhost:3000",
    );
    expect(appOrigin(requestFrom("http://localhost:4200/api/auth/login"))).toBe(
      "http://localhost:4200",
    );
  });

  it("prefers APP_ORIGIN over the bind address the proxy leaves in request.url", () => {
    process.env.APP_ORIGIN = "https://pensieve.example.com";
    expect(
      appOrigin(requestFrom("https://0.0.0.0:3000/api/auth/login")),
    ).toBe("https://pensieve.example.com");
  });

  it("normalizes a trailing slash or path away", () => {
    process.env.APP_ORIGIN = "https://pensieve.example.com/";
    expect(appOrigin(requestFrom("https://0.0.0.0:3000/x"))).toBe(
      "https://pensieve.example.com",
    );
    process.env.APP_ORIGIN = "https://pensieve.example.com/some/path";
    expect(appOrigin(requestFrom("https://0.0.0.0:3000/x"))).toBe(
      "https://pensieve.example.com",
    );
  });

  it("ignores a blank/whitespace APP_ORIGIN rather than producing an empty origin", () => {
    process.env.APP_ORIGIN = "   ";
    expect(appOrigin(requestFrom("http://localhost:3000/api/auth/login"))).toBe(
      "http://localhost:3000",
    );
  });

  it("throws on a malformed APP_ORIGIN instead of building an unusable redirect_uri", () => {
    process.env.APP_ORIGIN = "pensieve.example.com"; // no scheme
    expect(() => appOrigin(requestFrom("http://localhost:3000/x"))).toThrow(
      /APP_ORIGIN is not a valid absolute URL/,
    );
  });

  it("is not influenced by a spoofed X-Forwarded-Host (it reads no headers)", () => {
    process.env.APP_ORIGIN = "https://pensieve.example.com";
    const spoofed = {
      url: "https://0.0.0.0:3000/api/auth/callback",
      headers: new Headers({ "x-forwarded-host": "evil.example.net" }),
    } as unknown as Request;
    expect(appOrigin(spoofed)).toBe("https://pensieve.example.com");
  });
});
