import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  {
    id: 12,
    name: "Series",
    type: "dropdown",
    entityKey: "toy",
    order: 2,
    options: [
      { id: 21, customFieldId: 12, name: "Original", isDefault: true, order: 0 },
      { id: 22, customFieldId: 12, name: "Special Edition", isDefault: false, order: 1 },
    ],
  },
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
      { customFieldId: 12, customFieldName: "Series", customFieldType: "dropdown", value: "Original" },
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

  it("navigates to a toy's detail route when its row is clicked (mass edit off)", async () => {
    renderManager(false);
    await screen.findByText("Pikachu");

    fireEvent.click(screen.getByText("Pikachu"));

    expect(mockPush).toHaveBeenCalledWith("/toys/2");
  });

  it("does not navigate when the row's delete button is clicked", async () => {
    renderManager(false);
    await screen.findByText("R2-D2");

    const row = screen.getByText("R2-D2").closest("tr");
    fireEvent.click(
      within(row as HTMLElement).getByRole("button", { name: "Delete R2-D2" }),
    );

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not make rows click-navigable in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Pikachu");

    // In mass edit mode the cells are edit triggers, not a row link — clicking a
    // value opens its inline editor rather than navigating.
    fireEvent.click(screen.getByRole("button", { name: "Pikachu" }));

    expect(mockPush).not.toHaveBeenCalled();
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

  it("shows a dropdown value as a read-only pill when mass edit is off", async () => {
    renderManager(false);
    await screen.findByText("R2-D2");

    // The selected option is shown as text; there's no interactive listbox.
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Series" }),
    ).not.toBeInTheDocument();
  });

  it("toggles a yes/no custom field inline and PUTs the toy when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("R2-D2");

    const row = screen.getByText("R2-D2").closest("tr") as HTMLElement;
    // R2-D2's "Boxed" is true → clicking flips it to false.
    fireEvent.click(within(row).getByRole("button", { name: "Boxed: Yes" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) => /\/api\/toys\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 10,
      );
      expect(cf.value).toBe("false");
    });
  });

  it("edits a number custom field inline and PUTs the toy when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("R2-D2");

    const row = screen.getByText("R2-D2").closest("tr") as HTMLElement;
    // R2-D2's "Year" is 1977 → click to edit, change, commit.
    fireEvent.click(within(row).getByRole("button", { name: "Edit Year" }));
    const input = within(row).getByRole("spinbutton", { name: "Year" });
    fireEvent.change(input, { target: { value: "1980" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) => /\/api\/toys\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 11,
      );
      expect(cf.value).toBe("1980");
    });
  });

  it("edits a dropdown inline and PUTs the toy when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("R2-D2");

    const row = screen.getByText("R2-D2").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Series" }));
    fireEvent.click(screen.getByRole("option", { name: "Special Edition" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) => /\/api\/toys\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 12,
      );
      expect(cf.value).toBe("Special Edition");
    });
  });
});
