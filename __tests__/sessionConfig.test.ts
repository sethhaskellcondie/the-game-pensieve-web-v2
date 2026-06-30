import {
  sessionRole,
  toSessionView,
  type SessionData,
} from "@/lib/sessionConfig";

describe("sessionRole", () => {
  it("is guest when there is no access token", () => {
    expect(sessionRole({})).toBe("guest");
    expect(sessionRole({ role: "paid" })).toBe("guest");
  });

  it("reflects the stored role when authenticated", () => {
    expect(sessionRole({ accessToken: "t", role: "trial" })).toBe("trial");
    expect(sessionRole({ accessToken: "t", role: "paid" })).toBe("paid");
    expect(sessionRole({ accessToken: "t", role: "lapsed" })).toBe("lapsed");
    expect(sessionRole({ accessToken: "t", role: "admin" })).toBe("admin");
  });

  it("resolves an authenticated session with no stored role to unknown", () => {
    expect(sessionRole({ accessToken: "t" })).toBe("unknown");
  });
});

describe("toSessionView", () => {
  it("never exposes tokens and reports guest for an empty session", () => {
    const view = toSessionView({});
    expect(view).toEqual({ role: "guest", email: null });
  });

  it("maps an authenticated session to its role + email", () => {
    const session: SessionData = {
      accessToken: "a",
      refreshToken: "r",
      email: "collector@example.com",
      role: "lapsed",
    };
    expect(toSessionView(session)).toEqual({
      role: "lapsed",
      email: "collector@example.com",
    });
  });

  it("omits the email when not authenticated even if one lingers", () => {
    expect(toSessionView({ email: "x@y.z" })).toEqual({
      role: "guest",
      email: null,
    });
  });
});
