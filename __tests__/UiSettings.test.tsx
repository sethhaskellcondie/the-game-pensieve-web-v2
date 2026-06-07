import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import UiSettings from "@/components/UiSettings";

describe("UiSettings", () => {
  it("renders the three interface toggles, all off by default", () => {
    render(<UiSettings />);
    for (const name of ["Mass Input Mode", "Mass Edit Mode", "Developer Mode"]) {
      expect(screen.getByRole("switch", { name })).toHaveAttribute(
        "aria-checked",
        "false",
      );
    }
  });

  it("flips only the clicked toggle", () => {
    render(<UiSettings />);
    const massInput = screen.getByRole("switch", { name: "Mass Input Mode" });
    const developer = screen.getByRole("switch", { name: "Developer Mode" });

    fireEvent.click(massInput);

    expect(massInput).toHaveAttribute("aria-checked", "true");
    expect(developer).toHaveAttribute("aria-checked", "false");
  });
});
