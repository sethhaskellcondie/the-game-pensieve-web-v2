import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import type { CustomField, FilterRequestDto, FilterSpecification, System, VideoGameBox } from "@/lib/api";
import VideoGameBoxesManager from "@/components/video-games/VideoGameBoxesManager";
import { ToastProvider } from "@/components/ToastProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));
const mockPush = jest.fn();

const systems: System[] = [
  {
    id: 1,
    key: "system",
    name: "NES",
    generation: 3,
    handheld: false,
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 2,
    key: "system",
    name: "SNES",
    generation: 4,
    handheld: false,
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

const boxFields: CustomField[] = [
  { id: 10, name: "Condition", type: "text", entityKey: "videoGameBox", order: 0, options: [] },
  { id: 11, name: "Sealed", type: "boolean", entityKey: "videoGameBox", order: 1, options: [] },
];

const boxes: VideoGameBox[] = [
  {
    id: 31,
    key: "videoGameBox",
    title: "Super Mario All-Stars",
    system: systems[1],
    videoGames: [
      { id: 1, title: "Super Mario Bros.", customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
      { id: 2, title: "Super Mario Bros. 3", customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
    ],
    isPhysical: true,
    isCollection: true,
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Condition", customFieldType: "text", value: "Mint", valueOptionId: null },
      { customFieldId: 11, customFieldName: "Sealed", customFieldType: "boolean", value: "false", valueOptionId: null },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 32,
    key: "videoGameBox",
    title: "Chrono Trigger",
    system: systems[0],
    videoGames: [
      { id: 3, title: "Chrono Trigger", customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
    ],
    isPhysical: false,
    isCollection: false,
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

// Mirrors the live /filters/videoGameBox response: standard fields plus the
// sort/pagination/time pseudo-fields the field list drops.
const filterSpec: FilterSpecification = {
  type: "videoGameBox_filters",
  fields: {
    title: "text",
    system_id: "system",
    isPhysical: "boolean",
    isCollection: "boolean",
    created_at: "time",
    updated_at: "time",
    all_fields: "sort",
    pagination_fields: "pagination",
  },
  filters: {
    title: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    system_id: ["equals", "not_equals"],
    isPhysical: ["equals", "not_equals"],
    isCollection: ["equals", "not_equals"],
    created_at: ["since", "before"],
    updated_at: ["since", "before"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
  },
};

// A tiny stand-in for the backend's filter matching, enough to exercise the
// server-search wiring (the search box folds into a title-contains filter and
// the System filter matches on the system's id).
function matchOne(box: VideoGameBox, f: FilterRequestDto): boolean {
  const raw =
    f.field === "title"
      ? box.title
      : f.field === "system_id"
        ? String(box.system.id)
        : f.field === "isPhysical"
          ? String(box.isPhysical)
          : (box.customFieldValues.find((v) => v.customFieldName === f.field)
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

function applyFilters(
  list: VideoGameBox[],
  filters: FilterRequestDto[],
): VideoGameBox[] {
  return (filters ?? []).reduce(
    (out, f) => out.filter((box) => matchOne(box, f)),
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
  // A box update: echo back the body so the route's success path is exercised.
  if (/\/api\/video-game-boxes\/\d+$/.test(url) && method === "PUT") {
    return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
  }
  if (/\/api\/video-game-boxes\/\d+$/.test(url) && method === "DELETE") {
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }
  if (url.includes("/api/filters/videoGameBox")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: filterSpec }));
  }
  if (url.includes("/entity/videoGameBox")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: boxFields }));
  }
  // Checked after videoGameBox — "/entity/videoGame" is a substring of it.
  // The create dialog's stacked game form needs these; none are defined here.
  if (url.includes("/entity/videoGame")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: [] }));
  }
  // The create dialog's existing-game picker.
  if (url.includes("/api/video-games/search")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: [] }));
  }
  // Box creation: echo a box back so the manager can prepend it.
  if (url.endsWith("/api/video-game-boxes") && method === "POST") {
    const body = JSON.parse(init?.body as string);
    return Promise.resolve(
      jsonResponse({
        status: "ok",
        data: {
          ...boxes[0],
          id: 999,
          title: body.title,
          videoGames: body.newVideoGames.map(
            (g: { title: string }, i: number) => ({
              id: 900 + i,
              title: g.title,
              customFieldValues: [],
              createdAt: "",
              updatedAt: "",
              deletedAt: null,
            }),
          ),
        },
      }),
    );
  }
  // Server search: apply the request's filters to the box list.
  if (url.includes("/api/video-game-boxes/search")) {
    const body = init?.body ? JSON.parse(init.body as string) : { filters: [] };
    return Promise.resolve(
      jsonResponse({ status: "ok", data: applyFilters(boxes, body.filters) }),
    );
  }
  if (url.includes("/api/systems/search")) {
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
        <VideoGameBoxesManager />
      </UiSettingsProvider>
    </ToastProvider>,
  );
}

describe("VideoGameBoxesManager", () => {
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
      videoGameBox: {
        system: true,
        games: false,
        physical: true,
        collection: false,
      },
    });
    await screen.findByText("Super Mario All-Stars");

    expect(
      screen.getByRole("columnheader", { name: "Title" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "System" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Games" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Physical" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Collection" }),
    ).not.toBeInTheDocument();
  });

  it("loads the boxes with a count and renders the standard + custom-field columns", async () => {
    renderManager();

    expect(await screen.findByText("Super Mario All-Stars")).toBeInTheDocument();
    expect(screen.getByText("Chrono Trigger")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "2 Video Game Boxes" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("columnheader", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "System" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Games" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Physical" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Collection" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Condition" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Sealed" })).toBeInTheDocument();
  });

  it("shows each box's system name, game count, and physical/collection badges", async () => {
    renderManager();
    await screen.findByText("Super Mario All-Stars");

    const allStarsRow = screen
      .getByText("Super Mario All-Stars")
      .closest("tr") as HTMLElement;
    expect(within(allStarsRow).getByText("SNES")).toBeInTheDocument();
    expect(within(allStarsRow).getByText("2")).toBeInTheDocument();
    // Physical: Yes, Collection: Yes, Sealed: No — two Yes badges + a No.
    expect(within(allStarsRow).getAllByRole("img", { name: "Yes" })).toHaveLength(2);

    const chronoRow = screen
      .getByText("Chrono Trigger")
      .closest("tr") as HTMLElement;
    expect(within(chronoRow).getByText("NES")).toBeInTheDocument();
    expect(within(chronoRow).getByText("1")).toBeInTheDocument();
    // Digital, not a collection: Physical and Collection both read No.
    expect(within(chronoRow).getAllByRole("img", { name: "No" })).toHaveLength(2);
  });

  it("offers a New button but no per-row delete controls", async () => {
    renderManager();
    await screen.findByText("Super Mario All-Stars");

    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    // The filter bar is still there.
    expect(screen.getByRole("button", { name: "Add filter" })).toBeInTheDocument();

    // Delete moved off the grid row and onto the box detail page.
    expect(
      screen.queryByRole("button", { name: "Delete Super Mario All-Stars" }),
    ).not.toBeInTheDocument();
  });

  it("creates a box through the New dialog, POSTing the games payload and prepending the row", async () => {
    renderManager();
    await screen.findByText("Super Mario All-Stars");

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    const dialog = screen.getByRole("dialog", {
      name: "Create Video Game Box",
    });

    // Title + System via the dialog's editors.
    fireEvent.click(within(dialog).getByRole("button", { name: "Edit Title" }));
    const input = within(dialog).getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "Mega Man Collection" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(within(dialog).getByRole("button", { name: "System" }));
    fireEvent.click(within(dialog).getByRole("option", { name: "NES" }));

    // Queue one new game through the stacked dialog.
    fireEvent.click(screen.getByRole("button", { name: "Add New Game" }));
    const gameDialog = screen.getByRole("dialog", {
      name: "Create Video Game",
    });
    fireEvent.click(
      within(gameDialog).getByRole("button", { name: "Edit Title" }),
    );
    const gameTitle = within(gameDialog).getByRole("textbox", {
      name: "Title",
    });
    fireEvent.change(gameTitle, { target: { value: "Mega Man 2" } });
    fireEvent.keyDown(gameTitle, { key: "Enter" });
    fireEvent.click(within(gameDialog).getByRole("button", { name: "Create" }));

    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    // The POST carries the box fields and the queued game.
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Create Video Game Box" }),
      ).not.toBeInTheDocument(),
    );
    const post = mockFetch.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/api/video-game-boxes") &&
        init?.method === "POST",
    );
    expect(post).toBeTruthy();
    expect(JSON.parse(post![1].body as string)).toMatchObject({
      title: "Mega Man Collection",
      systemId: 1,
      existingVideoGameIds: [],
      newVideoGames: [
        { title: "Mega Man 2", systemId: 1, customFieldValues: [] },
      ],
      isPhysical: false,
    });

    // The created box (echoed by the route mock) lands at the top of the grid.
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Mega Man Collection")).toBeInTheDocument();
  });

  it("keeps the create dialog open and shows an error when the POST fails", async () => {
    renderManager();
    await screen.findByText("Super Mario All-Stars");

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    const dialog = screen.getByRole("dialog", {
      name: "Create Video Game Box",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Edit Title" }));
    const input = within(dialog).getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "Mega Man Collection" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(within(dialog).getByRole("button", { name: "System" }));
    fireEvent.click(within(dialog).getByRole("option", { name: "NES" }));
    fireEvent.click(screen.getByRole("button", { name: "Add New Game" }));
    const gameDialog = screen.getByRole("dialog", {
      name: "Create Video Game",
    });
    fireEvent.click(
      within(gameDialog).getByRole("button", { name: "Edit Title" }),
    );
    const gameTitle = within(gameDialog).getByRole("textbox", {
      name: "Title",
    });
    fireEvent.change(gameTitle, { target: { value: "Mega Man 2" } });
    fireEvent.keyDown(gameTitle, { key: "Enter" });
    fireEvent.click(within(gameDialog).getByRole("button", { name: "Create" }));

    // Make the POST fail.
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).endsWith("/api/video-game-boxes") && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({ status: "error", message: "boom" }, { ok: false, status: 502 }),
        );
      }
      return routedFetch(url, init);
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await screen.findByText(/Couldn't create the video game box/);
    // Still open, input preserved for a retry.
    expect(
      screen.getByRole("dialog", { name: "Create Video Game Box" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Mega Man 2")).toBeInTheDocument();
  });

  it("commits a title-contains chip on Enter and re-runs the search with the videoGameBox key", async () => {
    renderManager();
    await screen.findByText("Super Mario All-Stars");

    const box = screen.getByRole("searchbox", {
      name: "Search video game boxes",
    }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "chrono" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(
      screen.getByRole("button", { name: "Edit Title filter" }),
    ).toBeInTheDocument();
    expect(box.value).toBe("");

    await waitFor(() =>
      expect(
        screen.queryByText("Super Mario All-Stars"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Chrono Trigger")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "1 Video Game Box" }),
    ).toBeInTheDocument();

    const search = mockFetch.mock.calls.find(
      ([url, init]) =>
        url.includes("/api/video-game-boxes/search") &&
        init?.method === "POST" &&
        (init.body as string).includes("chrono"),
    );
    expect(search).toBeDefined();
    expect(JSON.parse(search![1].body).filters).toEqual([
      { key: "videoGameBox", field: "title", operator: "contains", operand: "chrono" },
    ]);
  });

  it("filters by system through a listbox of system names and sends the id", async () => {
    renderManager();
    await screen.findByText("Super Mario All-Stars");

    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Filter field" }));
    fireEvent.click(screen.getByRole("option", { name: "System" }));
    // The value control is a listbox of system names defaulting to the first
    // (NES) — apply it as-is.
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(
        screen.queryByText("Super Mario All-Stars"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Chrono Trigger")).toBeInTheDocument();

    const search = mockFetch.mock.calls.find(
      ([url, init]) =>
        url.includes("/api/video-game-boxes/search") &&
        init?.method === "POST" &&
        (init.body as string).includes("system_id"),
    );
    expect(search).toBeDefined();
    expect(JSON.parse(search![1].body).filters).toEqual([
      { key: "videoGameBox", field: "system_id", operator: "equals", operand: "1" },
    ]);
  });

  it("shows an empty-filter message when nothing matches", async () => {
    renderManager();
    await screen.findByText("Super Mario All-Stars");

    const box = screen.getByRole("searchbox", {
      name: "Search video game boxes",
    });
    fireEvent.change(box, { target: { value: "zzz" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(
      await screen.findByText("No video game boxes match your filters."),
    ).toBeInTheDocument();
  });

  it("navigates to a box's detail route when its row is clicked (mass edit off)", async () => {
    renderManager(false);
    await screen.findByText("Chrono Trigger");

    fireEvent.click(screen.getByText("Chrono Trigger"));

    expect(mockPush).toHaveBeenCalledWith("/video-game-boxes/32");
  });

  it("navigates to a box's detail route from the open-details button in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Super Mario All-Stars");

    const row = screen.getByText("Super Mario All-Stars").closest("tr");
    fireEvent.click(
      within(row as HTMLElement).getByRole("button", {
        name: "View Super Mario All-Stars",
      }),
    );

    expect(mockPush).toHaveBeenCalledWith("/video-game-boxes/31");
  });

  it("inline-edits a box's title and PUTs the full box (including its game ids) in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Super Mario All-Stars");

    fireEvent.click(
      screen.getByRole("button", { name: "Super Mario All-Stars" }),
    );
    const input = screen.getByRole("textbox", {
      name: "Title for Super Mario All-Stars",
    });
    fireEvent.change(input, { target: { value: "Mario All-Stars + World" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Optimistic update lands immediately.
    expect(
      await screen.findByText("Mario All-Stars + World"),
    ).toBeInTheDocument();

    const put = mockFetch.mock.calls.find(
      ([url, init]) =>
        /\/api\/video-game-boxes\/31$/.test(url) && init?.method === "PUT",
    );
    expect(put).toBeDefined();
    expect(JSON.parse(put![1].body)).toEqual({
      title: "Mario All-Stars + World",
      systemId: 2,
      existingVideoGameIds: [1, 2],
      newVideoGames: [],
      isPhysical: true,
      customFieldValues: boxes[0].customFieldValues,
    });
  });

  it("toggles Physical inline and PUTs the flipped value in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Super Mario All-Stars");

    const row = screen
      .getByText("Super Mario All-Stars")
      .closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Physical: Yes" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/video-game-boxes\/31$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      expect(JSON.parse(put![1].body)).toMatchObject({ isPhysical: false });
    });
  });

  it("keeps the Games count and Collection read-only even in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Super Mario All-Stars");

    const row = screen
      .getByText("Super Mario All-Stars")
      .closest("tr") as HTMLElement;
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: /Games/ }),
    ).not.toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: /Collection/ }),
    ).not.toBeInTheDocument();
  });

  it("changes a box's system through the dropdown and PUTs the new systemId", async () => {
    renderManager(true);
    await screen.findByText("Super Mario All-Stars");

    const row = screen
      .getByText("Super Mario All-Stars")
      .closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "System" }));
    fireEvent.click(screen.getByRole("option", { name: "NES" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/video-game-boxes\/31$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      expect(JSON.parse(put![1].body)).toMatchObject({ systemId: 1 });
    });
  });

  it("edits a text custom field inline and PUTs the box when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("Super Mario All-Stars");

    const row = screen
      .getByText("Super Mario All-Stars")
      .closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Edit Condition" }));
    const input = within(row).getByRole("textbox", { name: "Condition" });
    fireEvent.change(input, { target: { value: "Good" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/video-game-boxes\/31$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 10,
      );
      expect(cf.value).toBe("Good");
      expect(cf.valueOptionId).toBeNull();
    });
  });

  it("rolls back an optimistic edit when the PUT fails", async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (/\/api\/video-game-boxes\/\d+$/.test(url) && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse({ status: "error", message: "boom" }, { ok: false, status: 502 }),
        );
      }
      return routedFetch(url, init);
    });
    renderManager(true);
    await screen.findByText("Super Mario All-Stars");

    fireEvent.click(
      screen.getByRole("button", { name: "Super Mario All-Stars" }),
    );
    const input = screen.getByRole("textbox", {
      name: "Title for Super Mario All-Stars",
    });
    fireEvent.change(input, { target: { value: "Doomed Edit" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // After the failed request, the original title is restored.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Super Mario All-Stars" }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Doomed Edit")).not.toBeInTheDocument();
  });
});
