import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import type { CustomField, FilterRequestDto, FilterSpecification, System } from "@/lib/api";
import SystemsManager from "@/components/systems/SystemsManager";
import { ToastProvider } from "@/components/ToastProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));
const mockPush = jest.fn();

const systemFields: CustomField[] = [
  { id: 10, name: "Modded", type: "boolean", entityKey: "system", order: 0, options: [] },
  { id: 12, name: "Storage", type: "text", entityKey: "system", order: 2, options: [] },
  {
    id: 11,
    name: "Region",
    type: "dropdown",
    entityKey: "system",
    order: 1,
    options: [
      { id: 21, customFieldId: 11, name: "NTSC", isDefault: true, order: 0 },
      { id: 22, customFieldId: 11, name: "PAL", isDefault: false, order: 1 },
    ],
  },
];

const systems: System[] = [
  {
    id: 1,
    key: "system",
    name: "NES",
    generation: 3,
    handheld: false,
    customFieldValues: [
      { customFieldId: 12, customFieldName: "Storage", customFieldType: "text", value: "Cartridge" },
      { customFieldId: 10, customFieldName: "Modded", customFieldType: "boolean", value: "true" },
      { customFieldId: 11, customFieldName: "Region", customFieldType: "dropdown", value: "NTSC" },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 2,
    key: "system",
    name: "Game Boy",
    generation: 4,
    handheld: true,
    // Missing the "Region" value on purpose.
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Modded", customFieldType: "boolean", value: "false" },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

const filterSpec: FilterSpecification = {
  type: "system",
  fields: { name: "text", generation: "number", handheld: "boolean", created_at: "time" },
  filters: {
    name: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    generation: ["equals", "not_equals", "greater_than", "less_than"],
    handheld: ["equals"],
    created_at: ["since", "before"],
  },
};

// A tiny stand-in for the backend's filter matching, enough to exercise the
// server-search wiring (the search box folds into a name-contains filter).
function matchOne(system: System, f: FilterRequestDto): boolean {
  const raw =
    f.field === "name"
      ? system.name
      : f.field === "generation"
        ? String(system.generation)
        : f.field === "handheld"
          ? String(system.handheld)
          : (system.customFieldValues.find((v) => v.customFieldName === f.field)
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
    case "greater_than":
      return Number(a) > Number(b);
    case "less_than":
      return Number(a) < Number(b);
    default:
      return true;
  }
}

function applyFilters(list: System[], filters: FilterRequestDto[]): System[] {
  return (filters ?? []).reduce(
    (out, f) => out.filter((s) => matchOne(s, f)),
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
  // A system update: echo back the body so the route's success path is exercised.
  if (/\/api\/systems\/\d+$/.test(url) && method === "PUT") {
    return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
  }
  if (/\/api\/systems\/\d+$/.test(url) && method === "DELETE") {
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }
  if (url.includes("/api/filters/system")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: filterSpec }));
  }
  if (url.includes("/entity/system")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: systemFields }));
  }
  // Server search: apply the request's filters to the system list.
  if (url.includes("/api/systems/search")) {
    const body = init?.body ? JSON.parse(init.body as string) : { filters: [] };
    return Promise.resolve(
      jsonResponse({ status: "ok", data: applyFilters(systems, body.filters) }),
    );
  }
  if (url.includes("/api/systems")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: systems }));
  }
  return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
}

function renderManager(
  massEditMode = false,
  standardFields = DEFAULT_UI_SETTINGS.standardFields,
) {
  return render(
    <ToastProvider>
      <UiSettingsProvider
        initial={{ ...DEFAULT_UI_SETTINGS, massEditMode, standardFields }}
      >
        <SystemsManager />
      </UiSettingsProvider>
    </ToastProvider>,
  );
}

describe("SystemsManager", () => {
  beforeEach(() => {
    mockFetch.mockImplementation(routedFetch);
    global.fetch = mockFetch as unknown as typeof fetch;
    mockPush.mockReset();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("hides only the standard columns turned off in the settings", async () => {
    renderManager(false, {
      ...DEFAULT_UI_SETTINGS.standardFields,
      system: { generation: false, handheld: true },
    });
    await screen.findByText("NES");

    expect(
      screen.getByRole("columnheader", { name: "Name" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Generation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Handheld" }),
    ).toBeInTheDocument();
  });

  it("loads the systems with a count and renders the Name + Generation + Handheld + custom-field columns", async () => {
    renderManager();

    expect(await screen.findByText("NES")).toBeInTheDocument();
    expect(screen.getByText("Game Boy")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "2 Systems" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Generation" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Handheld" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Modded" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Region" })).toBeInTheDocument();
  });

  it("shows the generation as a number and handheld as a Yes/No marker", async () => {
    renderManager();
    await screen.findByText("NES");

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    // The handheld column shows Game Boy's Yes and NES's No (alongside the
    // Modded custom field's badges).
    const gameBoyRow = screen.getByText("Game Boy").closest("tr") as HTMLElement;
    expect(
      within(gameBoyRow).getAllByRole("img", { name: "Yes" }).length,
    ).toBeGreaterThanOrEqual(1);
    const nesRow = screen.getByText("NES").closest("tr") as HTMLElement;
    expect(
      within(nesRow).getAllByRole("img", { name: "No" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("commits a name-contains chip on Enter, clears the box, and re-runs the search", async () => {
    renderManager();
    await screen.findByText("NES");

    const box = screen.getByRole("searchbox", {
      name: "Search systems",
    }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "game" } });
    fireEvent.keyDown(box, { key: "Enter" });

    // A chip appears and the box is cleared.
    expect(
      screen.getByRole("button", { name: "Edit Name filter" }),
    ).toBeInTheDocument();
    expect(box.value).toBe("");

    // The chip drives a debounced server search down to the match.
    await waitFor(() =>
      expect(screen.queryByText("NES")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Game Boy")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "1 System" }),
    ).toBeInTheDocument();

    const search = mockFetch.mock.calls.find(
      ([url, init]) =>
        url.includes("/api/systems/search") && init?.method === "POST",
    );
    expect(search).toBeDefined();
  });

  it("shows an empty-filter message when nothing matches", async () => {
    renderManager();
    await screen.findByText("NES");

    const box = screen.getByRole("searchbox", { name: "Search systems" });
    fireEvent.change(box, { target: { value: "zzz" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(
      await screen.findByText("No systems match your filters."),
    ).toBeInTheDocument();
  });

  it("renders the New, Filter, and per-row delete controls", async () => {
    renderManager();
    await screen.findByText("NES");

    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add filter" })).toBeInTheDocument();

    const row = screen.getByText("NES").closest("tr");
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).getByRole("button", { name: "Delete NES" }),
    ).toBeInTheDocument();
  });

  it("omits the mass-edit crumb when mass edit mode is off", async () => {
    renderManager(false);
    await screen.findByText("NES");

    expect(
      screen.queryByText("Mass edit mode is on."),
    ).not.toBeInTheDocument();
    // Name stays plain text, not an inline-edit trigger button.
    expect(
      screen.queryByRole("button", { name: "NES" }),
    ).not.toBeInTheDocument();
  });

  it("shows the mass-edit crumb when mass edit mode is on", async () => {
    renderManager(true);
    await screen.findByText("NES");

    expect(
      screen.getByText("Mass edit mode is on."),
    ).toBeInTheDocument();
  });

  it("omits the open-details column when mass edit mode is off", async () => {
    renderManager(false);
    await screen.findByText("NES");

    expect(
      screen.queryByRole("button", { name: "View NES" }),
    ).not.toBeInTheDocument();
  });

  it("navigates to a system's detail route from the open-details button", async () => {
    renderManager(true);
    await screen.findByText("NES");

    const row = screen.getByText("NES").closest("tr");
    fireEvent.click(
      within(row as HTMLElement).getByRole("button", { name: "View NES" }),
    );

    expect(mockPush).toHaveBeenCalledWith("/systems/1");
  });

  it("navigates to a system's detail route when its row is clicked (mass edit off)", async () => {
    renderManager(false);
    await screen.findByText("Game Boy");

    fireEvent.click(screen.getByText("Game Boy"));

    expect(mockPush).toHaveBeenCalledWith("/systems/2");
  });

  it("does not navigate when the row's delete button is clicked", async () => {
    renderManager(false);
    await screen.findByText("NES");

    const row = screen.getByText("NES").closest("tr");
    fireEvent.click(
      within(row as HTMLElement).getByRole("button", { name: "Delete NES" }),
    );

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not make rows click-navigable in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Game Boy");

    // In mass edit mode the cells are edit triggers, not a row link — clicking a
    // value opens its inline editor rather than navigating.
    fireEvent.click(screen.getByRole("button", { name: "Game Boy" }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("inline-edits a system's name and PUTs the full system in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("NES");

    // Click the Name trigger to open the inline input, then edit + commit.
    fireEvent.click(screen.getByRole("button", { name: "NES" }));
    const input = screen.getByRole("textbox", { name: "Name for NES" });
    fireEvent.change(input, { target: { value: "Famicom" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Optimistic update lands immediately.
    expect(await screen.findByText("Famicom")).toBeInTheDocument();

    const put = mockFetch.mock.calls.find(
      ([url, init]) => /\/api\/systems\/1$/.test(url) && init?.method === "PUT",
    );
    expect(put).toBeDefined();
    expect(JSON.parse(put![1].body)).toEqual({
      name: "Famicom",
      generation: 3,
      handheld: false,
      customFieldValues: systems[0].customFieldValues,
    });
  });

  it("commits a blank name as a no-op (no PUT, value unchanged)", async () => {
    renderManager(true);
    await screen.findByText("NES");

    fireEvent.click(screen.getByRole("button", { name: "NES" }));
    const input = screen.getByRole("textbox", { name: "Name for NES" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("NES")).toBeInTheDocument();
    const put = mockFetch.mock.calls.find(
      ([url, init]) => /\/api\/systems\/1$/.test(url) && init?.method === "PUT",
    );
    expect(put).toBeUndefined();
  });

  it("inline-edits the generation and PUTs the full system with the numeric value", async () => {
    renderManager(true);
    await screen.findByText("NES");

    const row = screen.getByText("NES").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Edit Generation" }));
    const input = within(row).getByRole("spinbutton", { name: "Generation" });
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/systems\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      expect(JSON.parse(put![1].body)).toEqual({
        name: "NES",
        generation: 8,
        handheld: false,
        customFieldValues: systems[0].customFieldValues,
      });
    });
  });

  it("commits a cleared generation as a no-op (no PUT, value unchanged)", async () => {
    renderManager(true);
    await screen.findByText("NES");

    const row = screen.getByText("NES").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Edit Generation" }));
    const input = within(row).getByRole("spinbutton", { name: "Generation" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // The original value is still shown and nothing was persisted.
    expect(
      within(row).getByRole("button", { name: "Edit Generation" }),
    ).toHaveTextContent("3");
    const put = mockFetch.mock.calls.find(
      ([url, init]) => /\/api\/systems\/1$/.test(url) && init?.method === "PUT",
    );
    expect(put).toBeUndefined();
  });

  it("toggles handheld inline and PUTs the flipped boolean", async () => {
    renderManager(true);
    await screen.findByText("NES");

    const row = screen.getByText("NES").closest("tr") as HTMLElement;
    // NES's handheld is false → clicking flips it to true.
    fireEvent.click(within(row).getByRole("button", { name: "Handheld: No" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/systems\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      expect(JSON.parse(put![1].body)).toEqual({
        name: "NES",
        generation: 3,
        handheld: true,
        customFieldValues: systems[0].customFieldValues,
      });
    });
  });

  it("rolls back an optimistic edit when the PUT fails", async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (/\/api\/systems\/\d+$/.test(url) && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse({ status: "error", message: "boom" }, { ok: false, status: 502 }),
        );
      }
      return routedFetch(url, init);
    });
    renderManager(true);
    await screen.findByText("NES");

    fireEvent.click(screen.getByRole("button", { name: "NES" }));
    const input = screen.getByRole("textbox", { name: "Name for NES" });
    fireEvent.change(input, { target: { value: "Famicom" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // After the failed request, the original name is restored.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "NES" })).toBeInTheDocument(),
    );
    expect(screen.queryByText("Famicom")).not.toBeInTheDocument();
  });

  it("toggles a yes/no custom field inline and PUTs the system when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("NES");

    const row = screen.getByText("NES").closest("tr") as HTMLElement;
    // NES's "Modded" is true → clicking flips it to false.
    fireEvent.click(within(row).getByRole("button", { name: "Modded: Yes" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/systems\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 10,
      );
      expect(cf.value).toBe("false");
    });
  });

  it("shows a text custom field as plain read-only text when mass edit is off", async () => {
    renderManager(false);
    await screen.findByText("NES");

    expect(screen.getByText("Cartridge")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Storage" }),
    ).not.toBeInTheDocument();
  });

  it("edits a text custom field inline and PUTs the system when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("NES");

    const row = screen.getByText("NES").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Edit Storage" }));
    const input = within(row).getByRole("textbox", { name: "Storage" });
    fireEvent.change(input, { target: { value: "Disc" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/systems\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 12,
      );
      expect(cf.value).toBe("Disc");
    });
  });

  it("edits a dropdown inline and PUTs the system when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("NES");

    const row = screen.getByText("NES").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Region" }));
    fireEvent.click(screen.getByRole("option", { name: "PAL" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/systems\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 11,
      );
      expect(cf.value).toBe("PAL");
    });
  });

  it("deletes a system after the Are-you-sure confirmation and removes its row", async () => {
    renderManager();
    await screen.findByText("NES");

    fireEvent.click(screen.getByRole("button", { name: "Delete NES" }));

    // Nothing is sent until the menu's Delete confirms.
    const menu = screen.getByRole("menu", { name: "Delete NES?" });
    expect(within(menu).getByText("Are you sure?")).toBeInTheDocument();
    expect(
      mockFetch.mock.calls.some(([, init]) => init?.method === "DELETE"),
    ).toBe(false);

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }));

    await waitFor(() =>
      expect(screen.queryByText("NES")).not.toBeInTheDocument(),
    );
    const del = mockFetch.mock.calls.find(
      ([, init]) => init?.method === "DELETE",
    );
    expect(String(del![0])).toMatch(/\/api\/systems\/1$/);
    expect(screen.getByText("System deleted.")).toBeInTheDocument();
  });

  it("keeps the row and shows an error when the delete fails", async () => {
    renderManager();
    await screen.findByText("NES");

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

    fireEvent.click(screen.getByRole("button", { name: "Delete NES" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    await screen.findByText(/Couldn't delete the system/);
    expect(screen.getByText("NES")).toBeInTheDocument();
  });
});
