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
    expect(view).toEqual({
      role: "guest",
      email: null,
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase: null,
      authMode: "secured",
    });
  });

  it("maps an authenticated session to its role, email, and plan expiry", () => {
    const session: SessionData = {
      accessToken: "a",
      refreshToken: "r",
      email: "collector@example.com",
      role: "lapsed",
      accessUntil: 1785484800000,
    };
    expect(toSessionView(session)).toEqual({
      role: "lapsed",
      email: "collector@example.com",
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: 1785484800000,
      activeShowcase: null,
      authMode: "secured",
    });
  });

  it("omits the email and expiry when not authenticated even if they linger", () => {
    expect(toSessionView({ email: "x@y.z", accessUntil: 1785484800000 })).toEqual({
      role: "guest",
      email: null,
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase: null,
      authMode: "secured",
    });
  });

  it("reports impersonation with the admin email, expiry, and target's role", () => {
    // While impersonating, `email`/`accessUntil` stay the admin's and `role` is
    // the target's (the BFF overwrote it); the view exposes the target via
    // impersonatedEmail.
    const session: SessionData = {
      accessToken: "a",
      email: "admin@example.com",
      role: "paid",
      accessUntil: 1785484800000,
      impersonatingUserId: 42,
      impersonatedEmail: "user@example.com",
    };
    expect(toSessionView(session)).toEqual({
      role: "paid",
      email: "admin@example.com",
      isImpersonating: true,
      impersonatedEmail: "user@example.com",
      accessUntil: 1785484800000,
      activeShowcase: null,
      authMode: "secured",
    });
  });

  it("carries the resolved active showcase through to the view", () => {
    const active = { slug: "showcase-one", name: "Showcase One" };
    expect(toSessionView({}, active)).toEqual({
      role: "guest",
      email: null,
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase: active,
      authMode: "secured",
    });
    // Authenticated viewers browse showcases too — the selection is orthogonal
    // to auth state.
    expect(
      toSessionView({ accessToken: "a", role: "paid", email: "c@x.z" }, active),
    ).toEqual({
      role: "paid",
      email: "c@x.z",
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase: active,
      authMode: "secured",
    });
  });

  it("ignores a stray impersonation id on an unauthenticated session", () => {
    expect(
      toSessionView({ impersonatingUserId: 42, impersonatedEmail: "u@x.z" }),
    ).toEqual({
      role: "guest",
      email: null,
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase: null,
      authMode: "secured",
    });
  });

  it("ignores session contents entirely on an unsecured backend", () => {
    // A stale cookie from a secured deployment must not surface as a broken
    // half-logged-in state — unsecured mode has no accounts at all.
    const stale: SessionData = {
      accessToken: "a",
      email: "collector@example.com",
      role: "paid",
      accessUntil: 1785484800000,
      impersonatingUserId: 42,
      impersonatedEmail: "u@x.z",
    };
    expect(toSessionView(stale, null, "unsecured")).toEqual({
      role: "guest",
      email: null,
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase: null,
      authMode: "unsecured",
    });
  });

  it("still carries an active showcase through in unsecured mode", () => {
    const active = { slug: "showcase-one", name: "Showcase One" };
    expect(toSessionView({}, active, "unsecured")).toEqual({
      role: "guest",
      email: null,
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase: active,
      authMode: "unsecured",
    });
  });
});
