import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

  it("renders the five interface toggles, all off by default", () => {
    renderWithProvider();
    for (const name of [
      "Mass Input Mode",
      "Mass Edit Mode",
      "Developer Mode",
      "Hide Animations",
      "Beginner Mode",
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

  it("renders a default-view choice per collection with List selected by default", () => {
    renderWithProvider();

    for (const name of [
      "Default Video Games View",
      "Default Board Games View",
    ]) {
      const group = screen.getByRole("radiogroup", { name });
      expect(within(group).getByRole("radio", { name: "List" })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(
        within(group).getByRole("radio", { name: "Shelf" }),
      ).toHaveAttribute("aria-checked", "false");
    }
  });

  it("selects Shelf for video games and persists it once the write is confirmed", async () => {
    renderWithProvider();
    const group = screen.getByRole("radiogroup", {
      name: "Default Video Games View",
    });
    const shelf = within(group).getByRole("radio", { name: "Shelf" });

    fireEvent.click(shelf);

    await waitFor(() => expect(shelf).toHaveAttribute("aria-checked", "true"));
    expect(within(group).getByRole("radio", { name: "List" })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.videoGamesDefaultView).toBe("shelf");
    expect(body.boardGamesDefaultView).toBe("list");
  });

  it("selects Shelf for board games without touching the video games choice", async () => {
    renderWithProvider();
    const boardGroup = screen.getByRole("radiogroup", {
      name: "Default Board Games View",
    });
    const shelf = within(boardGroup).getByRole("radio", { name: "Shelf" });

    fireEvent.click(shelf);

    await waitFor(() => expect(shelf).toHaveAttribute("aria-checked", "true"));
    const videoGroup = screen.getByRole("radiogroup", {
      name: "Default Video Games View",
    });
    expect(
      within(videoGroup).getByRole("radio", { name: "List" }),
    ).toHaveAttribute("aria-checked", "true");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.boardGamesDefaultView).toBe("shelf");
    expect(body.videoGamesDefaultView).toBe("list");
  });
});
