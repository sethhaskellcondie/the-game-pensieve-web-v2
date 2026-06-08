import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UiSettings from "@/components/UiSettings";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

// UiSettings now reads/writes through the UiSettingsProvider context, so it is
// rendered inside a provider seeded with the all-false defaults. The optimistic
// write fires a fetch to /api/ui-settings, which we stub out.
function renderWithProvider() {
  return render(
    <UiSettingsProvider initial={DEFAULT_UI_SETTINGS}>
      <UiSettings />
    </UiSettingsProvider>,
  );
}

describe("UiSettings", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("renders the four interface toggles, all off by default", () => {
    renderWithProvider();
    for (const name of [
      "Mass Input Mode",
      "Mass Edit Mode",
      "Developer Mode",
      "Hide Animations",
    ]) {
      expect(screen.getByRole("switch", { name })).toHaveAttribute(
        "aria-checked",
        "false",
      );
    }
  });

  it("flips only the clicked toggle once the write is confirmed", async () => {
    renderWithProvider();
    const massInput = screen.getByRole("switch", { name: "Mass Input Mode" });
    const developer = screen.getByRole("switch", { name: "Developer Mode" });

    fireEvent.click(massInput);

    await waitFor(() =>
      expect(massInput).toHaveAttribute("aria-checked", "true"),
    );
    expect(developer).toHaveAttribute("aria-checked", "false");
  });
});
