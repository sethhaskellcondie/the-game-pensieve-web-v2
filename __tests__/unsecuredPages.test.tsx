import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import AccountPage from "@/app/account/page";
import AdminPage from "@/app/admin/page";
import LoginPage from "@/app/login/page";
import PricingPage from "@/app/pricing/page";
import { getAuthMode } from "@/lib/authMode";
import { loadSessionView } from "@/lib/session";
import type { SessionView } from "@/lib/sessionConfig";
import { notFound, redirect } from "next/navigation";

// On an unsecured (personal, local) backend the account/admin/login/pricing
// pages have nothing to show — no users, roles, plans, or logins exist — so
// each redirects home. These tests pin that, plus the secured-mode guards the
// pages already had, following the options.page.test.tsx pattern: with the
// session/auth-mode probes mocked the async pages resolve synchronously.
jest.mock("@/lib/session", () => ({
  loadSessionView: jest.fn(),
}));

jest.mock("@/lib/authMode", () => ({
  getAuthMode: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  // The login page's client forms reach for the router on render.
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const mockLoadSessionView = loadSessionView as jest.MockedFunction<
  typeof loadSessionView
>;
const mockGetAuthMode = getAuthMode as jest.MockedFunction<typeof getAuthMode>;
const mockRedirect = redirect as unknown as jest.Mock;
const mockNotFound = notFound as unknown as jest.Mock;

function view(overrides: Partial<SessionView> = {}): SessionView {
  return {
    role: "guest",
    email: null,
    isImpersonating: false,
    impersonatedEmail: null,
    accessUntil: null,
    activeShowcase: null,
    authMode: "secured",
    ...overrides,
  };
}

beforeEach(() => {
  mockRedirect.mockClear();
  mockNotFound.mockClear();
});

describe("AccountPage", () => {
  it("redirects home on an unsecured instance (no accounts exist)", async () => {
    mockLoadSessionView.mockResolvedValue(view({ authMode: "unsecured" }));
    await expect(AccountPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("still sends a secured-mode guest to log in", async () => {
    mockLoadSessionView.mockResolvedValue(view());
    await expect(AccountPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});

describe("AdminPage", () => {
  it("redirects home on an unsecured instance (no users or roles to manage)", async () => {
    mockLoadSessionView.mockResolvedValue(view({ authMode: "unsecured" }));
    await expect(AdminPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/");
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("still 404s a secured-mode non-admin", async () => {
    mockLoadSessionView.mockResolvedValue(
      view({ role: "paid", email: "collector@example.com" }),
    );
    await expect(AdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("LoginPage", () => {
  it("redirects home on an unsecured instance (nothing to log into)", async () => {
    mockGetAuthMode.mockResolvedValue("unsecured");
    await expect(LoginPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("renders the login and signup panels in secured mode", async () => {
    mockGetAuthMode.mockResolvedValue("secured");
    // The showcase switcher loads the directory on mount; a pending promise
    // keeps it in its initial state for this render test.
    global.fetch = jest.fn(
      () => new Promise(() => {}),
    ) as unknown as typeof fetch;
    render(await LoginPage());
    expect(
      screen.getByRole("region", { name: "Log in" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "New here?" }),
    ).toBeInTheDocument();
    // @ts-expect-error - cleanup of the per-test fetch stub
    delete global.fetch;
  });
});

describe("PricingPage", () => {
  it("redirects home on an unsecured instance (plans don't apply)", async () => {
    mockGetAuthMode.mockResolvedValue("unsecured");
    await expect(PricingPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("renders the plan cards in secured mode", async () => {
    mockGetAuthMode.mockResolvedValue("secured");
    render(await PricingPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Pricing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Collector plan" }),
    ).toBeInTheDocument();
  });
});
