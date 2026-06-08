import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  UiSettingsProvider,
  useUiSettings,
} from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

// Probe component that surfaces the context values and exposes a button to flip
// developer mode.
function Probe() {
  const { settings, setSetting } = useUiSettings();
  return (
    <div>
      <span data-testid="developer">{String(settings.developerMode)}</span>
      <span data-testid="massInput">{String(settings.massInputMode)}</span>
      <button onClick={() => setSetting("developerMode", true)}>flip</button>
    </div>
  );
}

describe("UiSettingsProvider", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("exposes the initial settings to consumers", () => {
    render(
      <UiSettingsProvider
        initial={{ massInputMode: true, massEditMode: false, developerMode: false }}
      >
        <Probe />
      </UiSettingsProvider>,
    );

    expect(screen.getByTestId("massInput")).toHaveTextContent("true");
    expect(screen.getByTestId("developer")).toHaveTextContent("false");
  });

  it("persists via /api/ui-settings and commits once the backend confirms", async () => {
    render(
      <UiSettingsProvider initial={DEFAULT_UI_SETTINGS}>
        <Probe />
      </UiSettingsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "flip" }));

    // The write is sent immediately, but the value only updates after the
    // backend acknowledges it.
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/ui-settings",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body).toEqual({
      massInputMode: false,
      massEditMode: false,
      developerMode: true,
    });

    await waitFor(() =>
      expect(screen.getByTestId("developer")).toHaveTextContent("true"),
    );
  });

  it("does not commit the change when the backend write fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ ok: false }) });

    render(
      <UiSettingsProvider initial={DEFAULT_UI_SETTINGS}>
        <Probe />
      </UiSettingsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "flip" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    // The optimistic value is never applied: a rejected write leaves it off.
    expect(screen.getByTestId("developer")).toHaveTextContent("false");
  });

  it("returns safe defaults and a no-op setter without a provider", () => {
    // Rendering the probe outside a provider must not throw and must read off.
    render(<Probe />);

    expect(screen.getByTestId("developer")).toHaveTextContent("false");
    fireEvent.click(screen.getByRole("button", { name: "flip" }));
    expect(screen.getByTestId("developer")).toHaveTextContent("false");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
