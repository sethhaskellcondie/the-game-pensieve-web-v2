import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import ApiHeartbeat from "@/components/ApiHeartbeat";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

// The API Tools section is only shown in developer mode, so render the
// component inside a provider seeded with that flag for the behavior tests.
function renderWithDeveloperMode() {
  return render(
    <UiSettingsProvider initial={{ ...DEFAULT_UI_SETTINGS, developerMode: true }}>
      <ApiHeartbeat />
    </UiSettingsProvider>,
  );
}

describe("ApiHeartbeat", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("renders nothing when developer mode is disabled", () => {
    const { container } = render(
      <UiSettingsProvider
        initial={{ ...DEFAULT_UI_SETTINGS, developerMode: false }}
      >
        <ApiHeartbeat />
      </UiSettingsProvider>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByRole("button", { name: "Check Heartbeat" }),
    ).not.toBeInTheDocument();
  });

  it("shows ONLINE with a latency reading on a successful ping", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "online" }),
    } as Response);

    renderWithDeveloperMode();
    fireEvent.click(screen.getByRole("button", { name: "Check Heartbeat" }));

    expect(await screen.findByText(/ONLINE/)).toBeInTheDocument();
    expect(screen.getByText(/ms$/)).toBeInTheDocument();
  });

  it("shows OFFLINE when the backend reports unhealthy", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ status: "offline" }),
    } as Response);

    renderWithDeveloperMode();
    fireEvent.click(screen.getByRole("button", { name: "Check Heartbeat" }));

    expect(await screen.findByText("OFFLINE")).toBeInTheDocument();
  });

  it("shows OFFLINE when the request throws", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));

    renderWithDeveloperMode();
    fireEvent.click(screen.getByRole("button", { name: "Check Heartbeat" }));

    expect(await screen.findByText("OFFLINE")).toBeInTheDocument();
  });
});
