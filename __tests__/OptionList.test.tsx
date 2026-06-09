import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { CustomFieldOption } from "@/lib/api";
import OptionList from "@/components/custom-fields/OptionList";

function opt(name: string, order: number): CustomFieldOption {
  return { id: order + 1, customFieldId: 1, name, isDefault: order === 0, order };
}

describe("OptionList", () => {
  it("shows a muted N/A when there are no options", () => {
    render(<OptionList options={[]} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("renders a chip per option for a short list", () => {
    render(<OptionList options={[opt("Light", 0), opt("Heavy", 1)]} />);
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Heavy")).toBeInTheDocument();
  });

  it("collapses overflow into a +N counter with the rest in the title", () => {
    const options = [
      opt("Worker Placement", 0),
      opt("Deck Building", 1),
      opt("Area Control", 2),
      opt("Engine Building", 3),
    ];
    render(<OptionList options={options} />);
    // The first long chip shows; the remainder collapse to a counter.
    expect(screen.getByText("Worker Placement")).toBeInTheDocument();
    const more = screen.getByText(/^\+\d+$/);
    expect(more).toBeInTheDocument();
    expect(more).toHaveAttribute("title");
  });

  it("orders chips by their option order", () => {
    render(<OptionList options={[opt("B", 1), opt("A", 0)]} />);
    const chips = screen.getAllByText(/^[AB]$/).map((el) => el.textContent);
    expect(chips).toEqual(["A", "B"]);
  });
});
