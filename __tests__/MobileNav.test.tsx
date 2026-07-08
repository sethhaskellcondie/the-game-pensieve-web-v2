import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import MobileNav from "@/components/MobileNav";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  // The drawer hosts the AccountMenu, which reads the router.
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const mockUsePathname = usePathname as jest.Mock;

function menuButton() {
  return screen.getByRole("button", { name: "Menu" });
}

describe("MobileNav", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
  });

  it("starts closed: hamburger collapsed and drawer links hidden", () => {
    render(<MobileNav />);

    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(menuButton()).toHaveAttribute("aria-controls", "mobile-nav-drawer");
    expect(
      screen.queryByRole("link", { name: "Video Games" }),
    ).not.toBeInTheDocument();
  });

  it("opens the drawer with the same nav links as the sidebar", () => {
    render(<MobileNav />);

    fireEvent.click(menuButton());

    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
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

  it("marks the drawer link matching the current path as active", () => {
    mockUsePathname.mockReturnValue("/board-games");
    render(<MobileNav />);

    fireEvent.click(menuButton());

    expect(screen.getByRole("link", { name: "Board Games" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Video Games" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("closes the drawer when a nav link is clicked", () => {
    render(<MobileNav />);

    fireEvent.click(menuButton());
    fireEvent.click(screen.getByRole("link", { name: "Toys" }));

    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: "Toys" }),
    ).not.toBeInTheDocument();
  });

  it("closes the drawer on Escape and returns focus to the hamburger", () => {
    render(<MobileNav />);

    fireEvent.click(menuButton());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(menuButton()).toHaveFocus();
  });

  it("toggles closed when the hamburger is clicked again", () => {
    render(<MobileNav />);

    fireEvent.click(menuButton());
    fireEvent.click(menuButton());

    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: "Video Games" }),
    ).not.toBeInTheDocument();
  });

  it("links the top-bar brand to the home page", () => {
    render(<MobileNav />);

    expect(screen.getByRole("link", { name: /pensieve/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
