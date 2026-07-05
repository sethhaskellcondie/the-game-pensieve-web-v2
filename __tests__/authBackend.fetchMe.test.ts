import { fetchMe, fetchRole } from "@/lib/authBackend";

// fetchMe hits GET /v1/auth/me and interprets the impersonation marker. The base
// URL comes from API_BASE_URL; pin it so the asserted request URL is stable.
const ORIGINAL_BASE = process.env.API_BASE_URL;
const originalFetch = global.fetch;

// Plain Response stub (jsdom's Response.json() is unreliable in this env).
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
  process.env.API_BASE_URL = "http://backend.test/v1";
});

afterAll(() => {
  process.env.API_BASE_URL = ORIGINAL_BASE;
  global.fetch = originalFetch;
});

afterEach(() => {
  jest.clearAllMocks();
  global.fetch = originalFetch;
});

describe("fetchMe", () => {
  it("returns the caller's own role on a normal request (no act-as header)", async () => {
    const mockFetch = jest.fn(async () =>
      jsonResponse({
        data: { id: 1, email: "me@x.com", role: "PAID", impersonating: null },
        errors: null,
      }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const me = await fetchMe("tok");
    expect(me).toEqual({ role: "paid", impersonatedEmail: null });

    const [, init] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-Act-As-Owner"]).toBeUndefined();
  });

  it("attaches the act-as header and reports the TARGET's role while impersonating", async () => {
    const mockFetch = jest.fn(async () =>
      jsonResponse({
        data: {
          id: 1,
          email: "admin@x.com",
          role: "ADMIN",
          impersonating: { id: 42, email: "user@x.com", role: "LAPSED" },
        },
        errors: null,
      }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const me = await fetchMe("tok", 42);
    // Effective role is the target's (LAPSED), and we surface the target email.
    expect(me).toEqual({ role: "lapsed", impersonatedEmail: "user@x.com" });

    const [url, init] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://backend.test/v1/auth/me");
    expect((init.headers as Record<string, string>)["X-Act-As-Owner"]).toBe("42");
  });

  it("treats a backend no-op (impersonating: null) as not impersonating", async () => {
    // The admin sent the header for a non-existent target; the backend ignores
    // it and answers as the admin. impersonatedEmail must be null so the caller
    // can detect the no-op and back out.
    const mockFetch = jest.fn(async () =>
      jsonResponse({
        data: { id: 1, email: "admin@x.com", role: "ADMIN", impersonating: null },
        errors: null,
      }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const me = await fetchMe("tok", 999);
    expect(me).toEqual({ role: "admin", impersonatedEmail: null });
  });

  it("returns null on a non-OK response (transient) so callers keep their role", async () => {
    const mockFetch = jest.fn(async () => jsonResponse({}, 503));
    global.fetch = mockFetch as unknown as typeof fetch;
    expect(await fetchMe("tok")).toBeNull();
  });

  it("fetchRole exposes only the effective role", async () => {
    const mockFetch = jest.fn(async () =>
      jsonResponse({
        data: { id: 1, email: "me@x.com", role: "TRIAL", impersonating: null },
        errors: null,
      }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;
    expect(await fetchRole("tok")).toBe("trial");
  });
});
