import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { CustomField } from "@/lib/api";
import CustomFieldsManager from "@/components/custom-fields/CustomFieldsManager";
import { ToastProvider } from "@/components/ToastProvider";

const boardFields: CustomField[] = [
  { id: 1, name: "Designers", type: "text", entityKey: "boardGame", order: 0, options: [] },
  {
    id: 2,
    name: "Theme",
    type: "dropdown",
    entityKey: "boardGame",
    order: 1,
    options: [
      { id: 9, customFieldId: 2, name: "Fantasy", isDefault: true, order: 0 },
    ],
  },
];

const videoFields: CustomField[] = [
  { id: 3, name: "Platform", type: "dropdown", entityKey: "videoGame", order: 0, options: [] },
];

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const mockFetch = jest.fn();

function routedFetch(url: string, init?: RequestInit) {
  const method = init?.method ?? "GET";
  if (method === "GET" && url.includes("/entity/boardGame")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: boardFields }));
  }
  if (method === "GET" && url.includes("/entity/videoGame")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: videoFields }));
  }
  if (method === "DELETE") {
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }
  return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
}

function renderManager() {
  return render(
    <ToastProvider>
      <CustomFieldsManager />
    </ToastProvider>,
  );
}

describe("CustomFieldsManager", () => {
  beforeEach(() => {
    mockFetch.mockImplementation(routedFetch);
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("loads and renders the scoped fields with a count", async () => {
    renderManager();
    expect(
      await screen.findByRole("button", { name: "Designers" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Theme" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Board Game" }),
    ).toBeInTheDocument();
  });

  it("refetches when the scoped entity changes", async () => {
    renderManager();
    await screen.findByRole("button", { name: "Designers" });

    fireEvent.click(screen.getByRole("button", { name: /board game/i }));
    fireEvent.click(screen.getByRole("option", { name: "Video Game" }));

    expect(
      await screen.findByRole("button", { name: "Platform" }),
    ).toBeInTheDocument();
    expect(
      mockFetch.mock.calls.some(([url]) =>
        String(url).includes("/entity/videoGame"),
      ),
    ).toBe(true);
  });

  it("deletes a field via the row delete button", async () => {
    renderManager();
    await screen.findByRole("button", { name: "Designers" });

    fireEvent.click(screen.getByRole("button", { name: "Delete Designers" }));

    await waitFor(() => {
      expect(
        mockFetch.mock.calls.some(
          ([url, init]) =>
            String(url).includes("/custom-fields/1") &&
            (init as RequestInit)?.method === "DELETE",
        ),
      ).toBe(true);
    });
    expect(
      screen.queryByRole("button", { name: "Designers" }),
    ).not.toBeInTheDocument();
  });

  it("opens the create modal from the New button", async () => {
    renderManager();
    await screen.findByRole("button", { name: "Designers" });

    fireEvent.click(screen.getByRole("button", { name: "New" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Create Custom Field" }),
    ).toBeInTheDocument();
  });
});
