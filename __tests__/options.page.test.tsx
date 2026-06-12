import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import OptionsPage from "@/app/options/page";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

describe("OptionsPage", () => {
  beforeEach(() => {
    // The Default Sort Options section fetches its data on mount; a pending
    // promise keeps it in its initial (disabled) state for these render tests.
    global.fetch = jest.fn(
      () => new Promise(() => {}),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    // @ts-expect-error - cleanup of the per-test fetch stub
    delete global.fetch;
  });

  it("renders the OPTIONS level-1 heading", () => {
    render(<OptionsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "OPTIONS",
    );
  });

  it("renders the UI Settings section", () => {
    render(<OptionsPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: "UI Settings" }),
    ).toBeInTheDocument();
  });

  it("renders the Default Sort Options section", () => {
    render(<OptionsPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Default Sort Options" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Default sort for Systems" }),
    ).toBeInTheDocument();
  });

  it("renders the Backup & Import section (always visible)", () => {
    render(<OptionsPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Backup & Import" }),
    ).toBeInTheDocument();
  });

  it("hides the API Tools section by default (developer mode off)", () => {
    render(<OptionsPage />);
    expect(
      screen.queryByRole("heading", { level: 2, name: "API Tools" }),
    ).not.toBeInTheDocument();
  });

  it("reveals the API Tools section when developer mode is on", () => {
    render(
      <UiSettingsProvider
        initial={{ ...DEFAULT_UI_SETTINGS, developerMode: true }}
      >
        <OptionsPage />
      </UiSettingsProvider>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "API Tools" }),
    ).toBeInTheDocument();
  });
});
