import "@testing-library/jest-dom";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Toggle from "@/components/Toggle";

// Small controlled wrapper so we can exercise the toggle's onChange contract.
function ControlledToggle({ initial = false }: { initial?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return <Toggle label="Demo Mode" checked={checked} onChange={setChecked} />;
}

describe("Toggle", () => {
  it("exposes itself as a switch with the given accessible name", () => {
    render(<Toggle label="Demo Mode" checked={false} onChange={() => {}} />);
    expect(screen.getByRole("switch", { name: "Demo Mode" })).toBeInTheDocument();
  });

  it("reflects the checked prop via aria-checked", () => {
    render(<Toggle label="Demo Mode" checked onChange={() => {}} />);
    expect(screen.getByRole("switch", { name: "Demo Mode" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("calls onChange with the negated value when clicked", () => {
    const onChange = jest.fn();
    render(<Toggle label="Demo Mode" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Demo Mode" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("flips aria-checked when wired to state", () => {
    render(<ControlledToggle />);
    const toggle = screen.getByRole("switch", { name: "Demo Mode" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});
