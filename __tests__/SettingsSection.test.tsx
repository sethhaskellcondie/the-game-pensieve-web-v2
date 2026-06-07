import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import SettingsSection from "@/components/SettingsSection";

describe("SettingsSection", () => {
  it("renders the title as a level-2 heading", () => {
    render(
      <SettingsSection title="UI Settings" description="Preferences.">
        <div>child</div>
      </SettingsSection>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "UI Settings" }),
    ).toBeInTheDocument();
  });

  it("renders the description and children", () => {
    render(
      <SettingsSection title="UI Settings" description="Preferences here.">
        <div>child content</div>
      </SettingsSection>,
    );
    expect(screen.getByText("Preferences here.")).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
