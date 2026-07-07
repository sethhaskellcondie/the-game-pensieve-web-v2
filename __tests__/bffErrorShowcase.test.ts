/**
 * @jest-environment node
 */
// errorResponse's stale-showcase handling: the backend tenant filter's 404
// envelope ("No public showcase exists…") must clear the gp_showcase cookie
// and surface the distinguishable SHOWCASE_UNAVAILABLE code, while every other
// error keeps the existing mapping.

import { ApiError } from "@/lib/api";
import { errorResponse, SHOWCASE_UNAVAILABLE_CODE } from "@/lib/bffError";
import { cookies } from "next/headers";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

function primeCookies() {
  const store = { set: jest.fn(), delete: jest.fn(), get: jest.fn() };
  mockCookies.mockResolvedValue(
    store as unknown as Awaited<ReturnType<typeof cookies>>,
  );
  return store;
}

beforeEach(() => jest.clearAllMocks());

describe("errorResponse", () => {
  it("clears the showcase cookie and marks the response for a vanished showcase", async () => {
    const store = primeCookies();
    const error = new ApiError(
      404,
      "Backend request failed: 404 Not Found (/toys/function/search): " +
        "No public showcase exists for the requested X-Showcase slug.",
    );
    const res = await errorResponse(error, "fallback");
    expect(res.status).toBe(404);
    expect(store.delete).toHaveBeenCalledWith("gp_showcase");
    const body = (await res.json()) as { code?: string; message: string };
    expect(body.code).toBe(SHOWCASE_UNAVAILABLE_CODE);
  });

  it("does not treat an ordinary 404 as a vanished showcase", async () => {
    const store = primeCookies();
    const res = await errorResponse(
      new ApiError(404, "Backend request failed: 404 Not Found (/toys/999)"),
      "fallback",
    );
    // Ordinary 404s keep the legacy mapping (collapsed to 502, no code).
    expect(res.status).toBe(502);
    expect(store.delete).not.toHaveBeenCalled();
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBeUndefined();
  });

  it("still passes through the auth/entitlement statuses", async () => {
    primeCookies();
    for (const status of [401, 402, 403]) {
      const res = await errorResponse(new ApiError(status, "nope"), "fallback");
      expect(res.status).toBe(status);
    }
  });

  it("collapses unknown failures to 502 with the fallback message", async () => {
    primeCookies();
    const res = await errorResponse("garbage", "Something broke");
    expect(res.status).toBe(502);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("Something broke");
  });
});
