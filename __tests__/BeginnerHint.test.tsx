import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import BeginnerHint from "@/components/BeginnerHint";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

const HINT_TEXT = "Click the seedling for tips.";

function renderWithBeginnerMode(beginnerMode: boolean) {
  return render(
    <UiSettingsProvider initial={{ ...DEFAULT_UI_SETTINGS, beginnerMode }}>
      <BeginnerHint text={HINT_TEXT} />
    </UiSettingsProvider>,
  );
}

describe("BeginnerHint", () => {
  it("renders nothing while beginner mode is off", () => {
    renderWithBeginnerMode(false);
    expect(
      screen.queryByRole("button", { name: "Beginner hint" }),
    ).not.toBeInTheDocument();
  });

  it("shows only the collapsed icon button when beginner mode is on", () => {
    renderWithBeginnerMode(true);
    const button = screen.getByRole("button", { name: "Beginner hint" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(HINT_TEXT)).not.toBeInTheDocument();
  });

  it("discloses the hint text when clicked and hides it again on a second click", () => {
    renderWithBeginnerMode(true);
    const button = screen.getByRole("button", { name: "Beginner hint" });

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const text = screen.getByRole("tooltip");
    expect(text).toHaveTextContent(HINT_TEXT);
    expect(button).toHaveAttribute("aria-controls", text.id);

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(HINT_TEXT)).not.toBeInTheDocument();
  });
});
