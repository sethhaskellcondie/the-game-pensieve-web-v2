import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import OptionsPage from "@/app/options/page";

describe("OptionsPage", () => {
  it("renders the OPTIONS level-1 heading", () => {
    render(<OptionsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "OPTIONS",
    );
  });

  it("renders the UI Settings and API Tools sections", () => {
    render(<OptionsPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: "UI Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "API Tools" }),
    ).toBeInTheDocument();
  });
});
