import { apiPost } from "@/lib/api";

// Builds a non-OK Response stub. readErrorDetail reads res.clone().json() first,
// then falls back to res.text(), so both are provided.
function errorResponse(body: unknown, { status = 500 } = {}): Response {
  const json = async () => body;
  return {
    ok: false,
    status,
    statusText: "Error",
    clone: () => ({ json }) as unknown as Response,
    json,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe("apiPost error handling", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    process.env.API_BASE_URL = "http://test.local/v1";
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    mockFetch.mockReset();
    delete process.env.API_BASE_URL;
  });

  it("includes the backend errors array in the thrown message", async () => {
    mockFetch.mockResolvedValue(
      errorResponse({ data: null, errors: ["already seeded", "try later"] }),
    );

    await expect(apiPost("/function/seedSampleData", {})).rejects.toThrow(
      /already seeded, try later/,
    );
  });

  it("serializes an object-shaped errors payload", async () => {
    mockFetch.mockResolvedValue(
      errorResponse({ data: null, errors: { reason: "duplicate" } }),
    );

    await expect(apiPost("/function/seedSampleData", {})).rejects.toThrow(
      /duplicate/,
    );
  });

  it("falls back to the status line when there is no error detail", async () => {
    mockFetch.mockResolvedValue(errorResponse({ data: null, errors: null }));

    await expect(apiPost("/function/seedSampleData", {})).rejects.toThrow(
      /Backend request failed: 500/,
    );
  });
});
