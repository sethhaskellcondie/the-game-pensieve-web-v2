import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import type { CustomField, FilterRequestDto, FilterSpecification, System, VideoGame } from "@/lib/api";
import VideoGamesManager from "@/components/video-games/VideoGamesManager";
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

const gameFields: CustomField[] = [
  { id: 10, name: "Favorite", type: "boolean", entityKey: "videoGame", order: 0, options: [] },
  { id: 12, name: "Developer", type: "text", entityKey: "videoGame", order: 2, options: [] },
  {
    id: 11,
    name: "Genre",
    type: "dropdown",
    entityKey: "videoGame",
    order: 1,
    options: [
      { id: 21, customFieldId: 11, name: "Action", isDefault: true, order: 0 },
      { id: 22, customFieldId: 11, name: "RPG", isDefault: false, order: 1 },
    ],
  },
];

const games: VideoGame[] = [
  {
    id: 1,
    key: "videoGame",
    title: "Super Mario Bros.",
    system: systems[0],
    videoGameBoxes: [
      { id: 31, title: "Super Mario Bros. / Duck Hunt" },
      { id: 32, title: "Super Mario Bros." },
    ],
    customFieldValues: [
      { customFieldId: 12, customFieldName: "Developer", customFieldType: "text", value: "Nintendo" },
      { customFieldId: 10, customFieldName: "Favorite", customFieldType: "boolean", value: "true" },
      { customFieldId: 11, customFieldName: "Genre", customFieldType: "dropdown", value: "Action" },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 2,
    key: "videoGame",
    title: "Chrono Trigger",
    system: systems[1],
    videoGameBoxes: [],
    // Missing the "Genre" value on purpose.
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Favorite", customFieldType: "boolean", value: "false" },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

// Mirrors the live /filters/videoGame response: standard fields including the
// system_id "system" kind plus sort/pagination/time pseudo-fields the field
// list drops.
const filterSpec: FilterSpecification = {
  type: "videoGame_filters",
  fields: {
    title: "text",
    system_id: "system",
    created_at: "time",
    updated_at: "time",
    all_fields: "sort",
    pagination_fields: "pagination",
  },
  filters: {
    title: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    system_id: ["equals", "not_equals"],
    created_at: ["since", "before"],
    updated_at: ["since", "before"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
  },
};

// A tiny stand-in for the backend's filter matching, enough to exercise the
// server-search wiring (the search box folds into a title-contains filter and
// the System filter matches on the system's id).
function matchOne(game: VideoGame, f: FilterRequestDto): boolean {
  const raw =
    f.field === "title"
      ? game.title
      : f.field === "system_id"
        ? String(game.system.id)
        : (game.customFieldValues.find((v) => v.customFieldName === f.field)
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

function applyFilters(list: VideoGame[], filters: FilterRequestDto[]): VideoGame[] {
  return (filters ?? []).reduce(
    (out, f) => out.filter((g) => matchOne(g, f)),
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
  // A game update: echo back the body so the route's success path is exercised.
  if (/\/api\/video-games\/\d+$/.test(url) && method === "PUT") {
    return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
  }
  if (url.includes("/api/filters/videoGame")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: filterSpec }));
  }
  if (url.includes("/entity/videoGame")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: gameFields }));
  }
  // Server search: apply the request's filters to the game list.
  if (url.includes("/api/video-games/search")) {
    const body = init?.body ? JSON.parse(init.body as string) : { filters: [] };
    return Promise.resolve(
      jsonResponse({ status: "ok", data: applyFilters(games, body.filters) }),
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
        <VideoGamesManager />
      </UiSettingsProvider>
    </ToastProvider>,
  );
}

describe("VideoGamesManager", () => {
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
      videoGame: { system: false, boxes: true },
    });
    await screen.findByText("Super Mario Bros.");

    expect(
      screen.getByRole("columnheader", { name: "Title" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "System" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Boxes" }),
    ).toBeInTheDocument();
  });

  it("loads the games with a count and renders the Title + System + Boxes + custom-field columns", async () => {
    renderManager();

    expect(await screen.findByText("Super Mario Bros.")).toBeInTheDocument();
    expect(screen.getByText("Chrono Trigger")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "2 Video Games" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("columnheader", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "System" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Boxes" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Favorite" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Genre" })).toBeInTheDocument();
  });

  it("shows each game's system name and its box count", async () => {
    renderManager();
    await screen.findByText("Super Mario Bros.");

    const marioRow = screen
      .getByText("Super Mario Bros.")
      .closest("tr") as HTMLElement;
    expect(within(marioRow).getByText("NES")).toBeInTheDocument();
    expect(within(marioRow).getByText("2")).toBeInTheDocument();

    const chronoRow = screen
      .getByText("Chrono Trigger")
      .closest("tr") as HTMLElement;
    expect(within(chronoRow).getByText("SNES")).toBeInTheDocument();
    expect(within(chronoRow).getByText("0")).toBeInTheDocument();
  });

  it("offers no New button and no per-row delete controls", async () => {
    renderManager();
    await screen.findByText("Super Mario Bros.");

    expect(screen.queryByRole("button", { name: "New" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Delete / }),
    ).not.toBeInTheDocument();
    // The filter bar is still there.
    expect(screen.getByRole("button", { name: "Add filter" })).toBeInTheDocument();
  });

  it("commits a title-contains chip on Enter, clears the box, and re-runs the search", async () => {
    renderManager();
    await screen.findByText("Super Mario Bros.");

    const box = screen.getByRole("searchbox", {
      name: "Search video games",
    }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "chrono" } });
    fireEvent.keyDown(box, { key: "Enter" });

    // A chip appears and the box is cleared.
    expect(
      screen.getByRole("button", { name: "Edit Title filter" }),
    ).toBeInTheDocument();
    expect(box.value).toBe("");

    // The chip drives a debounced server search down to the match.
    await waitFor(() =>
      expect(screen.queryByText("Super Mario Bros.")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Chrono Trigger")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "1 Video Game" }),
    ).toBeInTheDocument();

    const search = mockFetch.mock.calls.find(
      ([url, init]) =>
        url.includes("/api/video-games/search") && init?.method === "POST",
    );
    expect(search).toBeDefined();
  });

  it("shows an empty-filter message when nothing matches", async () => {
    renderManager();
    await screen.findByText("Super Mario Bros.");

    const box = screen.getByRole("searchbox", { name: "Search video games" });
    fireEvent.change(box, { target: { value: "zzz" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(
      await screen.findByText("No video games match your filters."),
    ).toBeInTheDocument();
  });

  it("filters by system through a listbox of system names and sends the id", async () => {
    renderManager();
    await screen.findByText("Super Mario Bros.");

    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Filter field" }));
    fireEvent.click(screen.getByRole("option", { name: "System" }));

    // The value control is a listbox of system names defaulting to the first
    // (NES) — apply it as-is.
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    // The chip shows the system's name, not its id.
    const chip = screen.getByRole("button", { name: "Edit System filter" });
    expect(within(chip).getByText("NES")).toBeInTheDocument();

    // Only the NES game remains.
    await waitFor(() =>
      expect(screen.queryByText("Chrono Trigger")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Super Mario Bros.")).toBeInTheDocument();

    // The search request carried the system's id as the operand.
    const search = mockFetch.mock.calls.find(
      ([url, init]) =>
        url.includes("/api/video-games/search") &&
        init?.method === "POST" &&
        (init.body as string).includes("system_id"),
    );
    expect(search).toBeDefined();
    expect(JSON.parse(search![1].body).filters).toEqual([
      { key: "videoGame", field: "system_id", operator: "equals", operand: "1" },
    ]);
  });

  it("omits the mass-edit crumb when mass edit mode is off", async () => {
    renderManager(false);
    await screen.findByText("Super Mario Bros.");

    expect(
      screen.queryByText("Mass edit mode is on."),
    ).not.toBeInTheDocument();
    // Title stays plain text, not an inline-edit trigger button.
    expect(
      screen.queryByRole("button", { name: "Super Mario Bros." }),
    ).not.toBeInTheDocument();
  });

  it("shows the mass-edit crumb when mass edit mode is on", async () => {
    renderManager(true);
    await screen.findByText("Super Mario Bros.");

    expect(
      screen.getByText("Mass edit mode is on."),
    ).toBeInTheDocument();
  });

  it("navigates to a game's detail route from the open-details button in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Super Mario Bros.");

    const row = screen.getByText("Super Mario Bros.").closest("tr");
    fireEvent.click(
      within(row as HTMLElement).getByRole("button", {
        name: "View Super Mario Bros.",
      }),
    );

    expect(mockPush).toHaveBeenCalledWith("/video-games/1");
  });

  it("navigates to a game's detail route when its row is clicked (mass edit off)", async () => {
    renderManager(false);
    await screen.findByText("Chrono Trigger");

    fireEvent.click(screen.getByText("Chrono Trigger"));

    expect(mockPush).toHaveBeenCalledWith("/video-games/2");
  });

  it("does not make rows click-navigable in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Chrono Trigger");

    // In mass edit mode the cells are edit triggers, not a row link — clicking a
    // value opens its inline editor rather than navigating.
    fireEvent.click(screen.getByRole("button", { name: "Chrono Trigger" }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("inline-edits a game's title and PUTs the full game in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Super Mario Bros.");

    // Click the Title trigger to open the inline input, then edit + commit.
    fireEvent.click(screen.getByRole("button", { name: "Super Mario Bros." }));
    const input = screen.getByRole("textbox", {
      name: "Title for Super Mario Bros.",
    });
    fireEvent.change(input, { target: { value: "Super Mario Bros. 3" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Optimistic update lands immediately.
    expect(await screen.findByText("Super Mario Bros. 3")).toBeInTheDocument();

    const put = mockFetch.mock.calls.find(
      ([url, init]) =>
        /\/api\/video-games\/1$/.test(url) && init?.method === "PUT",
    );
    expect(put).toBeDefined();
    expect(JSON.parse(put![1].body)).toEqual({
      title: "Super Mario Bros. 3",
      systemId: 1,
      customFieldValues: games[0].customFieldValues,
    });
  });

  it("commits a blank title as a no-op (no PUT, value unchanged)", async () => {
    renderManager(true);
    await screen.findByText("Super Mario Bros.");

    fireEvent.click(screen.getByRole("button", { name: "Super Mario Bros." }));
    const input = screen.getByRole("textbox", {
      name: "Title for Super Mario Bros.",
    });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("Super Mario Bros.")).toBeInTheDocument();
    const put = mockFetch.mock.calls.find(
      ([url, init]) =>
        /\/api\/video-games\/1$/.test(url) && init?.method === "PUT",
    );
    expect(put).toBeUndefined();
  });

  it("changes a game's system through the dropdown and PUTs the new systemId", async () => {
    renderManager(true);
    await screen.findByText("Super Mario Bros.");

    const row = screen
      .getByText("Super Mario Bros.")
      .closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "System" }));
    fireEvent.click(screen.getByRole("option", { name: "SNES" }));

    // Optimistic update shows the new system name in the row.
    expect(await within(row).findByText("SNES")).toBeInTheDocument();

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/video-games\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      expect(JSON.parse(put![1].body)).toEqual({
        title: "Super Mario Bros.",
        systemId: 2,
        customFieldValues: games[0].customFieldValues,
      });
    });
  });

  it("treats re-picking the game's current system as a no-op", async () => {
    renderManager(true);
    await screen.findByText("Super Mario Bros.");

    const row = screen
      .getByText("Super Mario Bros.")
      .closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "System" }));
    fireEvent.click(screen.getByRole("option", { name: "NES" }));

    const put = mockFetch.mock.calls.find(
      ([url, init]) =>
        /\/api\/video-games\/1$/.test(url) && init?.method === "PUT",
    );
    expect(put).toBeUndefined();
  });

  it("keeps the Boxes count read-only even in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Super Mario Bros.");

    const row = screen
      .getByText("Super Mario Bros.")
      .closest("tr") as HTMLElement;
    // The count renders as plain text with no editor trigger around it.
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: /Boxes/ }),
    ).not.toBeInTheDocument();
  });

  it("rolls back an optimistic edit when the PUT fails", async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (/\/api\/video-games\/\d+$/.test(url) && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse({ status: "error", message: "boom" }, { ok: false, status: 502 }),
        );
      }
      return routedFetch(url, init);
    });
    renderManager(true);
    await screen.findByText("Super Mario Bros.");

    fireEvent.click(screen.getByRole("button", { name: "Super Mario Bros." }));
    const input = screen.getByRole("textbox", {
      name: "Title for Super Mario Bros.",
    });
    fireEvent.change(input, { target: { value: "Doomed Edit" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // After the failed request, the original title is restored.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Super Mario Bros." }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Doomed Edit")).not.toBeInTheDocument();
  });

  it("toggles a yes/no custom field inline and PUTs the game when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("Super Mario Bros.");

    const row = screen
      .getByText("Super Mario Bros.")
      .closest("tr") as HTMLElement;
    // Mario's "Favorite" is true → clicking flips it to false.
    fireEvent.click(within(row).getByRole("button", { name: "Favorite: Yes" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/video-games\/1$/.test(url) && init?.method === "PUT",
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
    await screen.findByText("Super Mario Bros.");

    expect(screen.getByText("Nintendo")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Developer" }),
    ).not.toBeInTheDocument();
  });

  it("edits a dropdown custom field inline and PUTs the game when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("Super Mario Bros.");

    const row = screen
      .getByText("Super Mario Bros.")
      .closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Genre" }));
    fireEvent.click(screen.getByRole("option", { name: "RPG" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/video-games\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 11,
      );
      expect(cf.value).toBe("RPG");
    });
  });
});
