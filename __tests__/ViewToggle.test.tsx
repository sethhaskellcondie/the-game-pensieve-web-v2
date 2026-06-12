import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import ViewToggle from "@/components/video-games/ViewToggle";

describe("ViewToggle", () => {
  it("renders List and Shelf links with their view URLs", () => {
    render(<ViewToggle view="list" />);

    const nav = screen.getByRole("navigation", { name: "View" });
    expect(nav).toBeInTheDocument();
    // Explicit on both sides: the bare /video-games URL follows the user's
    // default-view setting, so "List" must say so in the URL.
    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute(
      "href",
      "/video-games?view=list",
    );
    expect(screen.getByRole("link", { name: "Shelf" })).toHaveAttribute(
      "href",
      "/video-games?view=shelf",
    );
  });

  it("marks the list segment current in list view", () => {
    render(<ViewToggle view="list" />);

    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Shelf" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks the shelf segment current in shelf view", () => {
    render(<ViewToggle view="shelf" />);

    expect(screen.getByRole("link", { name: "Shelf" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "List" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("builds the view URLs from basePath", () => {
    render(<ViewToggle view="list" basePath="/board-games" />);

    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute(
      "href",
      "/board-games?view=list",
    );
    expect(screen.getByRole("link", { name: "Shelf" })).toHaveAttribute(
      "href",
      "/board-games?view=shelf",
    );
  });
});
