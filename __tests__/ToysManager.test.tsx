import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import type { CustomField, FilterRequestDto, FilterSpecification, Toy } from "@/lib/api";
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
  {
    id: 13,
    name: "Condition",
    type: "radio_button",
    entityKey: "toy",
    order: 3,
    options: [
      { id: 31, customFieldId: 13, name: "Mint", isDefault: true, order: 0 },
      { id: 32, customFieldId: 13, name: "Used", isDefault: false, order: 1 },
    ],
  },
  {
    id: 14,
    name: "Build",
    type: "progress_bar",
    entityKey: "toy",
    order: 4,
    options: [
      { id: 41, customFieldId: 14, name: "Purchased", isDefault: true, order: 0 },
      { id: 42, customFieldId: 14, name: "Opened", isDefault: false, order: 1 },
      { id: 43, customFieldId: 14, name: "Painted", isDefault: false, order: 2 },
    ],
  },
  { id: 15, name: "Line", type: "text", entityKey: "toy", order: 5, options: [] },
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
      { customFieldId: 13, customFieldName: "Condition", customFieldType: "radio_button", value: "Mint" },
      { customFieldId: 14, customFieldName: "Build", customFieldType: "progress_bar", value: "Opened" },
      { customFieldId: 15, customFieldName: "Line", customFieldType: "text", value: "Astromech" },
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

const filterSpec: FilterSpecification = {
  type: "toy",
  fields: { name: "text", set: "text", created_at: "time" },
  filters: {
    name: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    set: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    created_at: ["since", "before"],
  },
};

// A tiny stand-in for the backend's filter matching, enough to exercise the
// server-search wiring (the search box folds into a name-contains filter).
function matchOne(toy: Toy, f: FilterRequestDto): boolean {
  const raw =
    f.field === "name"
      ? toy.name
      : f.field === "set"
        ? toy.set
        : (toy.customFieldValues.find((v) => v.customFieldName === f.field)
            ?.value ?? "");
  const a = String(raw).toLowerCase();
  const b = f.operand.toLowerCase();
  switch (f.operator) {
    case "contains":
      return a.includes(b);
    case "equals":
      return a === b;
    case "not_equals":
      return a !== b;
    case "starts_with":
      return a.startsWith(b);
    case "ends_with":
      return a.endsWith(b);
    default:
      return true;
  }
}

function applyFilters(list: Toy[], filters: FilterRequestDto[]): Toy[] {
  return (filters ?? []).reduce(
    (out, f) => out.filter((t) => matchOne(t, f)),
    list,
  );
}

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
  if (/\/api\/toys\/\d+$/.test(url) && method === "DELETE") {
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }
  if (url.includes("/api/filters/toy")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: filterSpec }));
  }
  if (url.includes("/entity/toy")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: toyFields }));
  }
  // Server search: apply the request's filters to the toy list.
  if (url.includes("/api/toys/search")) {
    const body = init?.body ? JSON.parse(init.body as string) : { filters: [] };
    return Promise.resolve(
      jsonResponse({ status: "ok", data: applyFilters(toys, body.filters) }),
    );
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

  it("commits a name-contains chip on Enter, clears the box, and re-runs the search", async () => {
    renderManager();
    await screen.findByText("R2-D2");

    const box = screen.getByRole("searchbox", {
      name: "Search toys",
    }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "pika" } });
    fireEvent.keyDown(box, { key: "Enter" });

    // A chip appears and the box is cleared.
    expect(
      screen.getByRole("button", { name: "Edit Name filter" }),
    ).toBeInTheDocument();
    expect(box.value).toBe("");

    // The chip drives a debounced server search down to the match.
    await waitFor(() =>
      expect(screen.queryByText("R2-D2")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Pikachu")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "1 Toy" }),
    ).toBeInTheDocument();

    const search = mockFetch.mock.calls.find(
      ([url, init]) =>
        url.includes("/api/toys/search") && init?.method === "POST",
    );
    expect(search).toBeDefined();
  });

  it("shows an empty-filter message when nothing matches", async () => {
    renderManager();
    await screen.findByText("R2-D2");

    const box = screen.getByRole("searchbox", { name: "Search toys" });
    fireEvent.change(box, { target: { value: "zzz" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(
      await screen.findByText("No toys match your filters."),
    ).toBeInTheDocument();
  });

  it("renders the New, Filter, and per-row delete controls", async () => {
    renderManager();
    await screen.findByText("R2-D2");

    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add filter" })).toBeInTheDocument();

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

  it("shows a progress value as a read-only pill with its position when mass edit is off", async () => {
    renderManager(false);
    await screen.findByText("R2-D2");

    // "Opened" is the 2nd of 3 stages.
    expect(screen.getByText("Opened")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("sets a progress stage inline and PUTs the toy when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("R2-D2");

    const row = screen.getByText("R2-D2").closest("tr") as HTMLElement;
    // Stages render as chips; selecting "Painted" commits it.
    fireEvent.click(within(row).getByRole("radio", { name: "Painted" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) => /\/api\/toys\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 14,
      );
      expect(cf.value).toBe("Painted");
    });
  });

  it("shows a radio value as a read-only pill when mass edit is off", async () => {
    renderManager(false);
    await screen.findByText("R2-D2");

    // The selected option shows as text in a pill; no interactive radios.
    expect(screen.getByText("Mint")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Mint" })).not.toBeInTheDocument();
  });

  it("selects a radio option inline and PUTs the toy when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("R2-D2");

    const row = screen.getByText("R2-D2").closest("tr") as HTMLElement;
    // All options render as radios; selecting "Used" commits.
    fireEvent.click(within(row).getByRole("radio", { name: "Used" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) => /\/api\/toys\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 13,
      );
      expect(cf.value).toBe("Used");
    });
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

  it("shows a text custom field as plain read-only text when mass edit is off", async () => {
    renderManager(false);
    await screen.findByText("R2-D2");

    expect(screen.getByText("Astromech")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Line" }),
    ).not.toBeInTheDocument();
  });

  it("edits a text custom field inline and PUTs the toy when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("R2-D2");

    const row = screen.getByText("R2-D2").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Edit Line" }));
    const input = within(row).getByRole("textbox", { name: "Line" });
    fireEvent.change(input, { target: { value: "Protocol Droid" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) => /\/api\/toys\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 15,
      );
      expect(cf.value).toBe("Protocol Droid");
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

  it("deletes a toy after the Are-you-sure confirmation and removes its row", async () => {
    renderManager();
    await screen.findByText("R2-D2");

    fireEvent.click(screen.getByRole("button", { name: "Delete R2-D2" }));

    // Nothing is sent until the menu's Delete confirms.
    const menu = screen.getByRole("menu", { name: "Delete R2-D2?" });
    expect(within(menu).getByText("Are you sure?")).toBeInTheDocument();
    expect(
      mockFetch.mock.calls.some(([, init]) => init?.method === "DELETE"),
    ).toBe(false);

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }));

    await waitFor(() =>
      expect(screen.queryByText("R2-D2")).not.toBeInTheDocument(),
    );
    const del = mockFetch.mock.calls.find(
      ([, init]) => init?.method === "DELETE",
    );
    expect(String(del![0])).toMatch(/\/api\/toys\/1$/);
    expect(screen.getByText("Toy deleted.")).toBeInTheDocument();
  });

  it("keeps the row and shows an error when the delete fails", async () => {
    renderManager();
    await screen.findByText("R2-D2");

    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve(
          jsonResponse(
            { status: "error", message: "boom" },
            { ok: false, status: 502 },
          ),
        );
      }
      return routedFetch(url, init);
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete R2-D2" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    await screen.findByText(/Couldn't delete the toy/);
    expect(screen.getByText("R2-D2")).toBeInTheDocument();
  });
});
