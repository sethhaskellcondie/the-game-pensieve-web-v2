import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { CustomField, Toy } from "@/lib/api";
import ToysManager from "@/components/toys/ToysManager";
import { ToastProvider } from "@/components/ToastProvider";

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

function routedFetch(url: string) {
  if (url.includes("/api/toys")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: toys }));
  }
  if (url.includes("/entity/toy")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: toyFields }));
  }
  return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
}

function renderManager() {
  return render(
    <ToastProvider>
      <ToysManager />
    </ToastProvider>,
  );
}

describe("ToysManager", () => {
  beforeEach(() => {
    mockFetch.mockImplementation(routedFetch);
    global.fetch = mockFetch as unknown as typeof fetch;
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
});
