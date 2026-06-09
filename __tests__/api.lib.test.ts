import { apiDelete, apiPost, apiPut } from "@/lib/api";

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

// Builds an OK Response stub whose body is a { data, errors } envelope.
function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("apiPut", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    process.env.API_BASE_URL = "http://test.local/v1";
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    mockFetch.mockReset();
    delete process.env.API_BASE_URL;
  });

  it("issues a PUT and returns the unwrapped data", async () => {
    mockFetch.mockResolvedValue(okResponse({ data: { id: 7 }, errors: null }));

    const result = await apiPut<{ id: number }>("/custom_fields/7", {
      custom_field: { name: "X", order: 0 },
    });

    expect(result).toEqual({ id: 7 });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://test.local/v1/custom_fields/7");
    expect(init.method).toBe("PUT");
  });

  it("throws when the envelope carries errors", async () => {
    mockFetch.mockResolvedValue(
      errorResponse({ data: null, errors: ["bad order"] }),
    );

    await expect(
      apiPut("/custom_fields/7", { custom_field: {} }),
    ).rejects.toThrow(/bad order/);
  });
});

describe("apiDelete", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    process.env.API_BASE_URL = "http://test.local/v1";
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    mockFetch.mockReset();
    delete process.env.API_BASE_URL;
  });

  it("resolves on a 204 with an empty body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "No Content",
      text: async () => "",
    } as unknown as Response);

    await expect(apiDelete("/custom_fields/7")).resolves.toBeUndefined();
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
  });

  it("throws the backend detail on a non-OK response", async () => {
    mockFetch.mockResolvedValue(
      errorResponse({ data: null, errors: ["not found"] }, { status: 404 }),
    );

    await expect(apiDelete("/custom_fields/7")).rejects.toThrow(/not found/);
  });
});
