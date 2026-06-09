import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import KindBadge from "@/components/custom-fields/KindBadge";

describe("KindBadge", () => {
  it("renders the human label for each backend type", () => {
    const { rerender } = render(<KindBadge type="text" />);
    expect(screen.getByText("Text")).toBeInTheDocument();

    rerender(<KindBadge type="boolean" />);
    expect(screen.getByText("Yes / No")).toBeInTheDocument();

    rerender(<KindBadge type="progress_bar" />);
    expect(screen.getByText("Progress Bar")).toBeInTheDocument();

    rerender(<KindBadge type="radio_button" />);
    expect(screen.getByText("Radio Button")).toBeInTheDocument();
  });
});
