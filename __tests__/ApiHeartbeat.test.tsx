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

  it("reports SECURED when the backend enforces auth", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "online", secureMode: true }),
    } as Response);

    renderWithDeveloperMode();
    fireEvent.click(screen.getByRole("button", { name: "Check Heartbeat" }));

    expect(await screen.findByText("SECURED")).toBeInTheDocument();
  });

  it("reports UNSECURED when the backend runs the permit-all build", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "online", secureMode: false }),
    } as Response);

    renderWithDeveloperMode();
    fireEvent.click(screen.getByRole("button", { name: "Check Heartbeat" }));

    expect(await screen.findByText("UNSECURED")).toBeInTheDocument();
  });

  it("omits the ONLINE label and the round-trip time on a successful ping", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "online", secureMode: true, version: "1.0.5" }),
    } as Response);

    renderWithDeveloperMode();
    fireEvent.click(screen.getByRole("button", { name: "Check Heartbeat" }));

    await screen.findByText("SECURED");
    expect(screen.queryByText(/ONLINE/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ms$/)).not.toBeInTheDocument();
  });

  it("stacks the security readout and the version in a single column", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "online", secureMode: true, version: "1.0.5" }),
    } as Response);

    renderWithDeveloperMode();
    fireEvent.click(screen.getByRole("button", { name: "Check Heartbeat" }));

    // Both readouts are their own element rather than one concatenated line,
    // so each renders on its own row of the status column.
    const secured = await screen.findByText("SECURED");
    const version = screen.getByText("v1.0.5");
    expect(version).toBeInTheDocument();
    expect(secured.parentElement).toBe(version.parentElement);
  });

  it("omits the version readout when the backend doesn't report it", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "online", secureMode: false }),
    } as Response);

    renderWithDeveloperMode();
    fireEvent.click(screen.getByRole("button", { name: "Check Heartbeat" }));

    expect(await screen.findByText("UNSECURED")).toBeInTheDocument();
    expect(screen.queryByText(/^v/)).not.toBeInTheDocument();
  });

  it("omits the security readout when the backend doesn't report it", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "online", version: "1.0.5" }),
    } as Response);

    renderWithDeveloperMode();
    fireEvent.click(screen.getByRole("button", { name: "Check Heartbeat" }));

    expect(await screen.findByText("v1.0.5")).toBeInTheDocument();
    expect(screen.queryByText(/SECURED/)).not.toBeInTheDocument();
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
