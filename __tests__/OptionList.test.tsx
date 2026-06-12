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

  it("renders every option for a long list with no +N counter", () => {
    const options = [
      opt("Worker Placement", 0),
      opt("Deck Building", 1),
      opt("Area Control", 2),
      opt("Engine Building", 3),
    ];
    render(<OptionList options={options} />);
    for (const o of options) {
      expect(screen.getByText(o.name)).toBeInTheDocument();
    }
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it("marks the default option with a * and leaves the others unmarked", () => {
    // opt() makes order 0 the default, so "Light" is default and "Heavy" isn't.
    render(<OptionList options={[opt("Light", 0), opt("Heavy", 1)]} />);
    const stars = screen.getAllByTitle("Default option");
    expect(stars).toHaveLength(1);
    expect(stars[0]).toHaveTextContent("*");
    // The star sits inside the default chip, next to its label.
    expect(screen.getByText("Light")).toContainElement(stars[0]);
  });

  it("orders chips by their option order", () => {
    render(<OptionList options={[opt("B", 1), opt("A", 0)]} />);
    // Read the label text node (the default chip also holds a "*" marker span).
    const chips = screen
      .getAllByText(/^[AB]/)
      .map((el) => el.firstChild?.textContent);
    expect(chips).toEqual(["A", "B"]);
  });
});
