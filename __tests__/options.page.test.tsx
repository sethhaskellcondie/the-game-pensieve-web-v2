import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import OptionsPage from "@/app/options/page";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";
import { readShowcaseSlug } from "@/lib/serverShowcase";
import { loadSessionView } from "@/lib/session";
import { redirect } from "next/navigation";

// The page is an async server component only because of its showcase-mode and
// auth redirect checks; with the cookie read and session view mocked it
// resolves synchronously and the rendered tree stays coverable here (per the
// project's testing notes). @/lib/session is mocked to keep iron-session (an
// ESM-only dep) out of the jsdom test runtime.
jest.mock("@/lib/serverShowcase", () => ({
  readShowcaseSlug: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  loadSessionView: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const mockReadShowcaseSlug = readShowcaseSlug as jest.MockedFunction<
  typeof readShowcaseSlug
>;
const mockLoadSessionView = loadSessionView as jest.MockedFunction<
  typeof loadSessionView
>;
const mockRedirect = redirect as unknown as jest.Mock;

describe("OptionsPage", () => {
  beforeEach(() => {
    mockReadShowcaseSlug.mockResolvedValue(null);
    // Options is authenticated-only; default the render tests to a signed-in
    // account so the page renders instead of redirecting to /login.
    mockLoadSessionView.mockResolvedValue({
      role: "paid",
      email: "collector@example.com",
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase: null,
    });
    mockRedirect.mockClear();
    // The Default Sort Options section fetches its data on mount; a pending
    // promise keeps it in its initial (disabled) state for these render tests.
    global.fetch = jest.fn(
      () => new Promise(() => {}),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    // @ts-expect-error - cleanup of the per-test fetch stub
    delete global.fetch;
  });

  it("renders the OPTIONS level-1 heading", async () => {
    render(await OptionsPage());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "OPTIONS",
    );
  });

  it("renders the UI Settings section", async () => {
    render(await OptionsPage());
    expect(
      screen.getByRole("heading", { level: 2, name: "UI Settings" }),
    ).toBeInTheDocument();
  });

  it("renders the Default Sort Options section", async () => {
    render(await OptionsPage());
    expect(
      screen.getByRole("heading", { level: 2, name: "Default Sort Options" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Default sort for Systems" }),
    ).toBeInTheDocument();
  });

  it("renders the Backup & Import section (always visible)", async () => {
    render(await OptionsPage());
    expect(
      screen.getByRole("heading", { level: 2, name: "Backup & Import" }),
    ).toBeInTheDocument();
  });

  it("hides the API Tools section by default (developer mode off)", async () => {
    render(await OptionsPage());
    expect(
      screen.queryByRole("heading", { level: 2, name: "API Tools" }),
    ).not.toBeInTheDocument();
  });

  it("reveals the API Tools section when developer mode is on", async () => {
    render(
      <UiSettingsProvider
        initial={{ ...DEFAULT_UI_SETTINGS, developerMode: true }}
      >
        {await OptionsPage()}
      </UiSettingsProvider>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "API Tools" }),
    ).toBeInTheDocument();
  });

  it("redirects home while a showcase is being viewed", async () => {
    mockReadShowcaseSlug.mockResolvedValue("showcase-one");
    await expect(OptionsPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("redirects a guest to login (Options is authenticated-only)", async () => {
    mockLoadSessionView.mockResolvedValue({
      role: "guest",
      email: null,
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase: null,
    });
    await expect(OptionsPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
