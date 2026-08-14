/**
 * The session secret is what stands between the internet and a forgeable
 * session cookie holding live Keycloak access + refresh tokens, so its
 * resolution rules are worth pinning down directly.
 *
 * The module is re-imported per case because NODE_ENV and SESSION_SECRET are
 * read inside the function, and jest.resetModules() keeps the accessor on
 * sessionOptions from caching across cases.
 */

const ORIGINAL_ENV = process.env;

// NODE_ENV is readonly in the Next type defs; tests legitimately need to set it.
function setNodeEnv(value: string) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    writable: true,
  });
}

async function loadResolver() {
  jest.resetModules();
  const mod = await import("@/lib/sessionConfig");
  return mod.resolveSessionSecret;
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("resolveSessionSecret", () => {
  it("throws in production when SESSION_SECRET is unset", async () => {
    setNodeEnv("production");
    delete process.env.SESSION_SECRET;

    const resolveSessionSecret = await loadResolver();

    expect(() => resolveSessionSecret()).toThrow(/SESSION_SECRET is required/);
  });

  it("throws in production when SESSION_SECRET is shorter than iron-session's 32-character floor", async () => {
    setNodeEnv("production");
    process.env.SESSION_SECRET = "a".repeat(31);

    const resolveSessionSecret = await loadResolver();

    expect(() => resolveSessionSecret()).toThrow(/at least 32 characters/);
  });

  it("accepts a 32-character secret in production", async () => {
    setNodeEnv("production");
    process.env.SESSION_SECRET = "b".repeat(32);

    const resolveSessionSecret = await loadResolver();

    expect(resolveSessionSecret()).toBe("b".repeat(32));
  });

  // The production throw must never reach the committed fallback. If a future
  // refactor reorders the checks, this is what catches it: a production
  // deployment silently sealing cookies with a public secret looks completely
  // healthy from the outside.
  it("never returns the committed dev fallback in production", async () => {
    setNodeEnv("production");
    process.env.SESSION_SECRET = "c".repeat(48);

    const resolveSessionSecret = await loadResolver();

    expect(resolveSessionSecret()).not.toContain("dev-only-insecure");
  });

  it("falls back to the dev secret outside production so dev and e2e need no configuration", async () => {
    setNodeEnv("development");
    delete process.env.SESSION_SECRET;

    const resolveSessionSecret = await loadResolver();

    expect(resolveSessionSecret()).toContain("dev-only-insecure");
  });

  it("still prefers a configured secret outside production", async () => {
    setNodeEnv("development");
    process.env.SESSION_SECRET = "d".repeat(40);

    const resolveSessionSecret = await loadResolver();

    expect(resolveSessionSecret()).toBe("d".repeat(40));
  });
});
