import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import NewButton from "@/components/NewButton";

describe("NewButton", () => {
  // The label is only clipped by CSS on a phone, never removed, so the button
  // answers to the same accessible name at every viewport width.
  it("is always named New, whatever the viewport", () => {
    render(<NewButton />);
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = jest.fn();
    render(<NewButton onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("can be disabled", () => {
    render(<NewButton disabled />);
    expect(screen.getByRole("button", { name: "New" })).toBeDisabled();
  });

  it("keeps its own class when a caller adds one", () => {
    render(<NewButton className="page-tweak" />);
    const button = screen.getByRole("button", { name: "New" });
    expect(button).toHaveClass("page-tweak");
    // The base <Button> style survives the append too.
    expect(button.className.split(" ").length).toBeGreaterThan(2);
  });
});
