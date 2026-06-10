import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import type { CustomField, Toy } from "@/lib/api";
import ToysManager from "@/components/toys/ToysManager";
import { ToastProvider } from "@/components/ToastProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));
const mockPush = jest.fn();

const toyFields: CustomField[] = [
  { id: 10, name: "Boxed", type: "boolean", entityKey: "toy", order: 0, options: [] },
  { id: 11, name: "Year", type: "number", entityKey: "toy", order: 1, options: [] },
];

const toys: Toy[] = [
  {
    id: 1,
    key: "toy",
    name: "R2-D2",
    set: "Star Wars",
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Boxed", customFieldType: "boolean", value: "true" },
      { customFieldId: 11, customFieldName: "Year", customFieldType: "number", value: "1977" },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 2,
    key: "toy",
    name: "Pikachu",
    set: "Pokemon",
    // Missing the "Year" value on purpose.
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Boxed", customFieldType: "boolean", value: "false" },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
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
  // A toy update: echo back the body so the route's success path is exercised.
  if (/\/api\/toys\/\d+$/.test(url) && method === "PUT") {
    return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
  }
  if (url.includes("/entity/toy")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: toyFields }));
  }
  if (url.includes("/api/toys")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: toys }));
  }
  return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
}

function renderManager(massEditMode = false) {
  return render(
    <ToastProvider>
      <UiSettingsProvider initial={{ ...DEFAULT_UI_SETTINGS, massEditMode }}>
        <ToysManager />
      </UiSettingsProvider>
    </ToastProvider>,
  );
}

describe("ToysManager", () => {
  beforeEach(() => {
    mockFetch.mockImplementation(routedFetch);
    global.fetch = mockFetch as unknown as typeof fetch;
    mockPush.mockReset();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("loads the toys with a count and renders the Name + Set + custom-field columns", async () => {
    renderManager();

    expect(await screen.findByText("R2-D2")).toBeInTheDocument();
    expect(screen.getByText("Pikachu")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "2 Toys" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Set" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Boxed" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Year" })).toBeInTheDocument();
  });

  it("formats boolean values as Yes/No markers", async () => {
    renderManager();
    await screen.findByText("R2-D2");

    expect(screen.getByRole("img", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "No" })).toBeInTheDocument();
  });

  it("filters the rows and count as you type in the search box", async () => {
    renderManager();
    await screen.findByText("R2-D2");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search toys" }), {
      target: { value: "pika" },
    });

    expect(screen.getByText("Pikachu")).toBeInTheDocument();
    expect(screen.queryByText("R2-D2")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "1 Toy" }),
    ).toBeInTheDocument();
  });

  it("shows an empty-search message when nothing matches", async () => {
    renderManager();
    await screen.findByText("R2-D2");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search toys" }), {
      target: { value: "zzz" },
    });

    expect(screen.getByText("No toys match your search.")).toBeInTheDocument();
  });

  it("renders the New, Filter, and per-row delete controls", async () => {
    renderManager();
    await screen.findByText("R2-D2");

    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();

    const row = screen.getByText("R2-D2").closest("tr");
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).getByRole("button", { name: "Delete R2-D2" }),
    ).toBeInTheDocument();
  });

  it("omits the mass-edit crumb when mass edit mode is off", async () => {
    renderManager(false);
    await screen.findByText("R2-D2");

    expect(
      screen.queryByText("Mass edit mode is on. (adjust in options)"),
    ).not.toBeInTheDocument();
    // Name/Set stay plain text, not inline-edit trigger buttons.
    expect(
      screen.queryByRole("button", { name: "R2-D2" }),
    ).not.toBeInTheDocument();
  });

  it("shows the mass-edit crumb when mass edit mode is on", async () => {
    renderManager(true);
    await screen.findByText("R2-D2");

    expect(
      screen.getByText("Mass edit mode is on. (adjust in options)"),
    ).toBeInTheDocument();
  });

  it("omits the open-details column when mass edit mode is off", async () => {
    renderManager(false);
    await screen.findByText("R2-D2");

    expect(
      screen.queryByRole("button", { name: "View R2-D2" }),
    ).not.toBeInTheDocument();
  });

  it("navigates to a toy's detail route from the open-details button", async () => {
    renderManager(true);
    await screen.findByText("R2-D2");

    const row = screen.getByText("R2-D2").closest("tr");
    fireEvent.click(
      within(row as HTMLElement).getByRole("button", { name: "View R2-D2" }),
    );

    expect(mockPush).toHaveBeenCalledWith("/toys/1");
  });

  it("inline-edits a toy's name and PUTs the full toy in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("R2-D2");

    // Click the Name trigger to open the inline input, then edit + commit.
    fireEvent.click(screen.getByRole("button", { name: "R2-D2" }));
    const input = screen.getByRole("textbox", { name: "Name for R2-D2" });
    fireEvent.change(input, { target: { value: "Artoo" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Optimistic update lands immediately.
    expect(await screen.findByText("Artoo")).toBeInTheDocument();

    const put = mockFetch.mock.calls.find(
      ([url, init]) => /\/api\/toys\/1$/.test(url) && init?.method === "PUT",
    );
    expect(put).toBeDefined();
    expect(JSON.parse(put![1].body)).toEqual({
      name: "Artoo",
      set: "Star Wars",
      customFieldValues: toys[0].customFieldValues,
    });
  });

  it("commits a blank name as a no-op (no PUT, value unchanged)", async () => {
    renderManager(true);
    await screen.findByText("R2-D2");

    fireEvent.click(screen.getByRole("button", { name: "R2-D2" }));
    const input = screen.getByRole("textbox", { name: "Name for R2-D2" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("R2-D2")).toBeInTheDocument();
    const put = mockFetch.mock.calls.find(
      ([url, init]) => /\/api\/toys\/1$/.test(url) && init?.method === "PUT",
    );
    expect(put).toBeUndefined();
  });
});
