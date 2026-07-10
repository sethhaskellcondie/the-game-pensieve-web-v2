import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import type { SessionView } from "@/lib/sessionConfig";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  // The Sidebar now hosts the AccountMenu, which reads the router.
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const mockUsePathname = usePathname as jest.Mock;

describe("Sidebar", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
  });

  it("renders every nav link pointing at the correct route", () => {
    render(<Sidebar />);

    const expectedLinks: Array<[string, string]> = [
      ["Video Games", "/video-games"],
      ["Board Games", "/board-games"],
      ["Toys", "/toys"],
      ["Systems", "/systems"],
      ["Custom Fields", "/custom-fields"],
      ["Options", "/options"],
    ];

    for (const [name, href] of expectedLinks) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("links the brand to the home page", () => {
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /pensieve/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("marks the link matching the current path as active", () => {
    mockUsePathname.mockReturnValue("/board-games");
    render(<Sidebar />);

    const active = screen.getByRole("link", { name: "Board Games" });
    expect(active).toHaveAttribute("aria-current", "page");

    const inactive = screen.getByRole("link", { name: "Video Games" });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("shows the beginner hint when beginner mode is on", () => {
    render(
      <UiSettingsProvider
        initial={{ ...DEFAULT_UI_SETTINGS, beginnerMode: true }}
      >
        <Sidebar />
      </UiSettingsProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Beginner hint" }),
    ).toBeInTheDocument();
  });

  it("omits the beginner hint when beginner mode is off", () => {
    render(<Sidebar />);
    expect(
      screen.queryByRole("button", { name: "Beginner hint" }),
    ).not.toBeInTheDocument();
  });

  it("marks no nav link active when the path matches none of them", () => {
    mockUsePathname.mockReturnValue("/unknown");
    render(<Sidebar />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  // Options manages the viewer's own settings, so a secured-mode guest has no
  // use for it — but on an unsecured (personal, local) backend the anonymous
  // caller owns the collection and the link must stay.
  function renderAsGuest(authMode?: SessionView["authMode"]) {
    const view: SessionView = {
      role: "guest",
      email: null,
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase: null,
      authMode,
    };
    render(
      <SessionProvider initial={view}>
        <Sidebar />
      </SessionProvider>,
    );
  }

  it("hides the Options link from a secured-mode guest", () => {
    renderAsGuest("secured");
    expect(
      screen.queryByRole("link", { name: "Options" }),
    ).not.toBeInTheDocument();
  });

  it("shows the Options link to the anonymous caller of an unsecured instance", () => {
    renderAsGuest("unsecured");
    expect(screen.getByRole("link", { name: "Options" })).toHaveAttribute(
      "href",
      "/options",
    );
  });
});
