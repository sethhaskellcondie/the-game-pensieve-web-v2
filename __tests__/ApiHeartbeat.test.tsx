import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import ApiHeartbeat from "@/components/ApiHeartbeat";

describe("ApiHeartbeat", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("shows ONLINE with a latency reading on a successful ping", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "online" }),
    } as Response);

    render(<ApiHeartbeat />);
    fireEvent.click(screen.getByRole("button", { name: "Check Heartbeat" }));

    expect(await screen.findByText(/ONLINE/)).toBeInTheDocument();
    expect(screen.getByText(/ms$/)).toBeInTheDocument();
  });

  it("shows OFFLINE when the backend reports unhealthy", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ status: "offline" }),
    } as Response);

    render(<ApiHeartbeat />);
    fireEvent.click(screen.getByRole("button", { name: "Check Heartbeat" }));

    expect(await screen.findByText("OFFLINE")).toBeInTheDocument();
  });

  it("shows OFFLINE when the request throws", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));

    render(<ApiHeartbeat />);
    fireEvent.click(screen.getByRole("button", { name: "Check Heartbeat" }));

    expect(await screen.findByText("OFFLINE")).toBeInTheDocument();
  });
});
