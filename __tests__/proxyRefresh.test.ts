/**
 * @jest-environment node
 */
// Silent-refresh concurrency in the proxy.
//
// The production realm sets `revokeRefreshToken: true` / `refreshTokenMaxReuse: 0`,
// so spending a refresh token twice is not a harmless retry: Keycloak reads it as
// token reuse and revokes the entire user session. The proxy runs on every matched
// request, and a single page load fires several `/api/*` calls at once — so without
// single-flight, one expired access token would put every concurrent request into
// the token endpoint with the same refresh token and log the user out.
//
// These tests pin the two shapes that matters: concurrent callers share one call,
// and a caller that arrives just afterwards still carrying the old cookie replays
// the result instead of spending the dead token.

import { proxy } from "@/proxy";
import { getIronSession } from "iron-session";
import { fetchMe } from "@/lib/authBackend";
import { refreshTokens, OidcError } from "@/lib/oidc";
import { NextRequest } from "next/server";

jest.mock("iron-session", () => ({ getIronSession: jest.fn() }));
jest.mock("@/lib/authBackend", () => ({ fetchMe: jest.fn() }));
jest.mock("@/lib/oidc", () => {
  const actual = jest.requireActual("@/lib/oidc");
  return { ...actual, refreshTokens: jest.fn() };
});

const mockGetIronSession = getIronSession as jest.MockedFunction<typeof getIronSession>;
const mockFetchMe = fetchMe as jest.MockedFunction<typeof fetchMe>;
const mockRefreshTokens = refreshTokens as jest.MockedFunction<typeof refreshTokens>;

interface FakeSession {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  role?: string;
  accessUntil?: string;
  impersonatingUserId?: number;
  impersonatedEmail?: string;
  save: jest.Mock;
  destroy: jest.Mock;
}

// A session whose access token lapsed an hour ago, holding the given refresh token.
function staleSession(refreshToken: string): FakeSession {
  return {
    accessToken: "old-access",
    refreshToken,
    accessTokenExpiresAt: Date.now() - 3_600_000,
    save: jest.fn(),
    destroy: jest.fn(),
  };
}

function request(): NextRequest {
  return new NextRequest("https://pensieve.example.com/api/systems");
}

// Each proxy() call gets its own session object, exactly as a real concurrent
// request would — they are independently sealed copies of the same cookie.
function useSessions(...sessions: FakeSession[]): void {
  let i = 0;
  mockGetIronSession.mockImplementation(async () => {
    const session = sessions[Math.min(i, sessions.length - 1)];
    i += 1;
    return session as never;
  });
}

function tokens(suffix: string) {
  return {
    accessToken: `new-access-${suffix}`,
    refreshToken: `new-refresh-${suffix}`,
    idToken: undefined,
    tokenType: "Bearer",
    expiresInMs: 900_000,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchMe.mockResolvedValue(null);
});

describe("proxy silent refresh — single flight", () => {
  it("calls the token endpoint once for concurrent requests sharing a refresh token", async () => {
    // Unique per test: the grace cache is module state keyed by the spent token.
    const spent = "rt-concurrent";
    const a = staleSession(spent);
    const b = staleSession(spent);
    const c = staleSession(spent);
    useSessions(a, b, c);

    let release!: (value: ReturnType<typeof tokens>) => void;
    mockRefreshTokens.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    // All three enter the refresh path before any of them completes.
    const inflight = [proxy(request()), proxy(request()), proxy(request())];
    await Promise.resolve();
    release(tokens("1"));
    await Promise.all(inflight);

    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    expect(mockRefreshTokens).toHaveBeenCalledWith(spent);
    for (const session of [a, b, c]) {
      expect(session.accessToken).toBe("new-access-1");
      expect(session.refreshToken).toBe("new-refresh-1");
      expect(session.destroy).not.toHaveBeenCalled();
    }
  });

  it("replays the result for a request that still carries the spent token", async () => {
    // The browser dispatched this one before the rotated Set-Cookie reached it.
    const spent = "rt-late-arrival";
    const first = staleSession(spent);
    const late = staleSession(spent);
    useSessions(first, late);
    mockRefreshTokens.mockResolvedValue(tokens("2"));

    await proxy(request());
    await proxy(request());

    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    expect(late.accessToken).toBe("new-access-2");
    expect(late.refreshToken).toBe("new-refresh-2");
    expect(late.destroy).not.toHaveBeenCalled();
  });

  it("stamps the expiry from when the refresh returned, not from when it is replayed", async () => {
    const spent = "rt-expiry";
    const first = staleSession(spent);
    const late = staleSession(spent);
    useSessions(first, late);
    mockRefreshTokens.mockResolvedValue(tokens("3"));

    await proxy(request());
    const stamped = first.accessTokenExpiresAt;
    await proxy(request());

    // A replayed caller must NOT push the expiry forward — that would send a
    // token the server already considers dead.
    expect(late.accessTokenExpiresAt).toBe(stamped);
  });

  it("does not cache a transient failure — the next request retries", async () => {
    const spent = "rt-transient";
    const first = staleSession(spent);
    const second = staleSession(spent);
    useSessions(first, second);
    // status 0 = network failure, which oidc.ts defines as never meaning a dead token.
    mockRefreshTokens.mockRejectedValueOnce(new OidcError(0, "socket hang up"));
    mockRefreshTokens.mockResolvedValueOnce(tokens("4"));

    await proxy(request());
    expect(first.destroy).not.toHaveBeenCalled();
    expect(first.accessToken).toBe("old-access");

    await proxy(request());
    expect(mockRefreshTokens).toHaveBeenCalledTimes(2);
    expect(second.accessToken).toBe("new-access-4");
  });

  it("destroys the session on a definitive invalid_grant", async () => {
    const spent = "rt-dead";
    const dead = staleSession(spent);
    useSessions(dead);
    mockRefreshTokens.mockRejectedValue(
      new OidcError(400, "Invalid refresh token", "invalid_grant"),
    );

    await proxy(request());

    expect(dead.destroy).toHaveBeenCalled();
  });

  it("leaves a session with a live access token alone", async () => {
    const fresh = staleSession("rt-unused");
    fresh.accessTokenExpiresAt = Date.now() + 10 * 60_000;
    useSessions(fresh);

    await proxy(request());

    expect(mockRefreshTokens).not.toHaveBeenCalled();
    expect(fresh.save).not.toHaveBeenCalled();
  });
});
