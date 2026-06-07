import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import Header from "@/components/Header";

const baseProps = {
  icon: <span data-testid="icon" />,
  title: "THE GAME",
  titleAccent: "PENSIEVE",
  tagline: "Explore ALL your games.",
};

describe("Header", () => {
  it("renders the title and accent together in the level-1 heading", () => {
    render(<Header {...baseProps} />);

    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading).toHaveTextContent("THE GAME PENSIEVE");
  });

  it("renders the tagline", () => {
    render(<Header {...baseProps} />);

    expect(screen.getByText("Explore ALL your games.")).toBeInTheDocument();
  });

  it("renders the provided icon node", () => {
    render(<Header {...baseProps} />);

    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders children passed to it", () => {
    render(
      <Header {...baseProps}>
        <div data-testid="child" />
      </Header>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("applies the construction styling only when the construction variant is set", () => {
    const { rerender } = render(<Header {...baseProps} />);
    expect(screen.getByRole("banner")).not.toHaveClass("construction");

    rerender(<Header {...baseProps} variant="construction" />);
    expect(screen.getByRole("banner")).toHaveClass("construction");
  });
});
