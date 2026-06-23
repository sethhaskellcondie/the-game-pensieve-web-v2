import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import type { BoardGame, CustomField, FilterRequestDto, FilterSpecification } from "@/lib/api";
import BoardGamesManager from "@/components/board-games/BoardGamesManager";
import { ToastProvider } from "@/components/ToastProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));
const mockPush = jest.fn();

const gameFields: CustomField[] = [
  { id: 10, name: "Has App", type: "boolean", entityKey: "boardGame", order: 0, options: [] },
  { id: 12, name: "Publisher", type: "text", entityKey: "boardGame", order: 2, options: [] },
  {
    id: 11,
    name: "Weight",
    type: "dropdown",
    entityKey: "boardGame",
    order: 1,
    options: [
      { id: 21, customFieldId: 11, name: "Light", isDefault: true, order: 0 },
      { id: 22, customFieldId: 11, name: "Heavy", isDefault: false, order: 1 },
    ],
  },
];

const games: BoardGame[] = [
  {
    id: 1,
    key: "boardGame",
    title: "Set-A-Watch",
    boardGameBoxes: [
      {
        id: 31,
        title: "Set-A-Watch",
        isExpansion: false,
        isStandAlone: true,
        baseSetId: null,
        customFieldValues: [],
        createdAt: "",
        updatedAt: "",
        deletedAt: null,
      },
      {
        id: 32,
        title: "Set-A-Watch Doomed Run",
        isExpansion: true,
        isStandAlone: false,
        baseSetId: 31,
        customFieldValues: [],
        createdAt: "",
        updatedAt: "",
        deletedAt: null,
      },
    ],
    customFieldValues: [
      { customFieldId: 12, customFieldName: "Publisher", customFieldType: "text", value: "Rock Manor Games", valueOptionId: null },
      { customFieldId: 10, customFieldName: "Has App", customFieldType: "boolean", value: "true", valueOptionId: null },
      { customFieldId: 11, customFieldName: "Weight", customFieldType: "dropdown", value: "Light", valueOptionId: 21 },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 2,
    key: "boardGame",
    title: "Jekyll vs Hyde",
    boardGameBoxes: [],
    // Missing the "Weight" value on purpose.
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Has App", customFieldType: "boolean", value: "false", valueOptionId: null },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

// Mirrors the live /filters/boardGame response: title + timestamps plus the
// sort/pagination pseudo-fields the field list drops. Board games have no
// relationship (system-kind) filter fields.
const filterSpec: FilterSpecification = {
  type: "boardGame_filters",
  fields: {
    title: "text",
    created_at: "time",
    updated_at: "time",
    all_fields: "sort",
    pagination_fields: "pagination",
  },
  filters: {
    title: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    created_at: ["since", "before"],
    updated_at: ["since", "before"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
  },
};

// A tiny stand-in for the backend's filter matching, enough to exercise the
// server-search wiring (the search box folds into a title-contains filter).
function matchOne(game: BoardGame, f: FilterRequestDto): boolean {
  const raw =
    f.field === "title"
      ? game.title
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

function applyFilters(list: BoardGame[], filters: FilterRequestDto[]): BoardGame[] {
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
  if (/\/api\/board-games\/\d+$/.test(url) && method === "PUT") {
    return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
  }
  if (url.includes("/api/filters/boardGame")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: filterSpec }));
  }
  if (url.includes("/entity/boardGame")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: gameFields }));
  }
  // Server search: apply the request's filters to the game list.
  if (url.includes("/api/board-games/search")) {
    const body = init?.body ? JSON.parse(init.body as string) : { filters: [] };
    return Promise.resolve(
      jsonResponse({ status: "ok", data: applyFilters(games, body.filters) }),
    );
  }
  return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
}

function renderManager(
  massEditMode = false,
  standardFields = DEFAULT_UI_SETTINGS.standardFields,
  beginnerMode = false,
) {
  return render(
    <ToastProvider>
      <UiSettingsProvider
        initial={{
          ...DEFAULT_UI_SETTINGS,
          massEditMode,
          standardFields,
          beginnerMode,
        }}
      >
        <BoardGamesManager />
      </UiSettingsProvider>
    </ToastProvider>,
  );
}

describe("BoardGamesManager", () => {
  beforeEach(() => {
    // Filters now persist in localStorage; clear so tests don't leak filters.
    localStorage.clear();
    mockFetch.mockImplementation(routedFetch);
    global.fetch = mockFetch as unknown as typeof fetch;
    mockPush.mockReset();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("hides the Boxes column when it is hidden in the standard-field settings", async () => {
    renderManager(false, {
      ...DEFAULT_UI_SETTINGS.standardFields,
      boardGame: { boxes: false },
    });
    await screen.findByText("Set-A-Watch");

    expect(
      screen.getByRole("columnheader", { name: "Title" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Boxes" }),
    ).not.toBeInTheDocument();
    // Custom-field columns are unaffected.
    expect(
      screen.getByRole("columnheader", { name: "Has App" }),
    ).toBeInTheDocument();
  });

  it("loads the games with a count and renders the Title + Boxes + custom-field columns", async () => {
    renderManager();

    expect(await screen.findByText("Set-A-Watch")).toBeInTheDocument();
    expect(screen.getByText("Jekyll vs Hyde")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "2 Board Games" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("columnheader", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Boxes" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Has App" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Weight" })).toBeInTheDocument();
    // Board games have no system column.
    expect(
      screen.queryByRole("columnheader", { name: "System" }),
    ).not.toBeInTheDocument();
  });

  it("shows each game's box count", async () => {
    renderManager();
    await screen.findByText("Set-A-Watch");

    const watchRow = screen
      .getByText("Set-A-Watch")
      .closest("tr") as HTMLElement;
    expect(within(watchRow).getByText("2")).toBeInTheDocument();

    const jekyllRow = screen
      .getByText("Jekyll vs Hyde")
      .closest("tr") as HTMLElement;
    expect(within(jekyllRow).getByText("0")).toBeInTheDocument();
  });

  it("offers no New button and no per-row delete controls", async () => {
    renderManager();
    await screen.findByText("Set-A-Watch");

    expect(screen.queryByRole("button", { name: "New" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Delete / }),
    ).not.toBeInTheDocument();
    // The filter bar is still there.
    expect(screen.getByRole("button", { name: "Add filter" })).toBeInTheDocument();
  });

  it("commits a title-contains chip on Enter, clears the box, and re-runs the search", async () => {
    renderManager();
    await screen.findByText("Set-A-Watch");

    const box = screen.getByRole("searchbox", {
      name: "Search board games",
    }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "jekyll" } });
    fireEvent.keyDown(box, { key: "Enter" });

    // A chip appears and the box is cleared.
    expect(
      screen.getByRole("button", { name: "Edit Title filter" }),
    ).toBeInTheDocument();
    expect(box.value).toBe("");

    // The chip drives a debounced server search down to the match.
    await waitFor(() =>
      expect(screen.queryByText("Set-A-Watch")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Jekyll vs Hyde")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "1 Board Game" }),
    ).toBeInTheDocument();

    const search = mockFetch.mock.calls.find(
      ([url, init]) =>
        url.includes("/api/board-games/search") && init?.method === "POST",
    );
    expect(search).toBeDefined();
  });

  it("shows an empty-filter message when nothing matches", async () => {
    renderManager();
    await screen.findByText("Set-A-Watch");

    const box = screen.getByRole("searchbox", { name: "Search board games" });
    fireEvent.change(box, { target: { value: "zzz" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(
      await screen.findByText("No board games match your filters."),
    ).toBeInTheDocument();
  });

  it("omits the mass-edit hint when mass edit mode is off", async () => {
    renderManager(false, DEFAULT_UI_SETTINGS.standardFields, true);
    await screen.findByText("Set-A-Watch");

    screen
      .queryAllByRole("button", { name: "Beginner hint" })
      .forEach((h) => fireEvent.click(h));
    expect(
      screen.queryByText(
        /Mass Edit Mode is on, this allows you to make in-line edits/,
      ),
    ).not.toBeInTheDocument();
    // Title stays plain text, not an inline-edit trigger button.
    expect(
      screen.queryByRole("button", { name: "Set-A-Watch" }),
    ).not.toBeInTheDocument();
  });

  it("shows the mass-edit hint when mass edit and beginner mode are on", async () => {
    renderManager(true, DEFAULT_UI_SETTINGS.standardFields, true);
    await screen.findByText("Set-A-Watch");

    screen
      .getAllByRole("button", { name: "Beginner hint" })
      .forEach((h) => fireEvent.click(h));
    expect(
      screen.getByText(
        /Mass Edit Mode is on, this allows you to make in-line edits/,
      ),
    ).toBeInTheDocument();
  });

  it("hides the mass-edit hint when beginner mode is off", async () => {
    renderManager(true);
    await screen.findByText("Set-A-Watch");

    expect(
      screen.queryByRole("button", { name: "Beginner hint" }),
    ).not.toBeInTheDocument();
  });

  it("navigates to a game's detail route from the open-details button in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Set-A-Watch");

    const row = screen.getByText("Set-A-Watch").closest("tr");
    fireEvent.click(
      within(row as HTMLElement).getByRole("button", {
        name: "View Set-A-Watch",
      }),
    );

    expect(mockPush).toHaveBeenCalledWith("/board-games/1");
  });

  it("navigates to a game's detail route when its row is clicked (mass edit off)", async () => {
    renderManager(false);
    await screen.findByText("Jekyll vs Hyde");

    fireEvent.click(screen.getByText("Jekyll vs Hyde"));

    expect(mockPush).toHaveBeenCalledWith("/board-games/2");
  });

  it("inline-edits a game's title and PUTs the full game in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Set-A-Watch");

    // Click the Title trigger to open the inline input, then edit + commit.
    fireEvent.click(screen.getByRole("button", { name: "Set-A-Watch" }));
    const input = screen.getByRole("textbox", {
      name: "Title for Set-A-Watch",
    });
    fireEvent.change(input, { target: { value: "Set-A-Watch (2nd Ed.)" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Optimistic update lands immediately.
    expect(await screen.findByText("Set-A-Watch (2nd Ed.)")).toBeInTheDocument();

    const put = mockFetch.mock.calls.find(
      ([url, init]) =>
        /\/api\/board-games\/1$/.test(url) && init?.method === "PUT",
    );
    expect(put).toBeDefined();
    expect(JSON.parse(put![1].body)).toEqual({
      title: "Set-A-Watch (2nd Ed.)",
      customFieldValues: games[0].customFieldValues,
    });
  });

  it("commits a blank title as a no-op (no PUT, value unchanged)", async () => {
    renderManager(true);
    await screen.findByText("Set-A-Watch");

    fireEvent.click(screen.getByRole("button", { name: "Set-A-Watch" }));
    const input = screen.getByRole("textbox", {
      name: "Title for Set-A-Watch",
    });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("Set-A-Watch")).toBeInTheDocument();
    const put = mockFetch.mock.calls.find(
      ([url, init]) =>
        /\/api\/board-games\/1$/.test(url) && init?.method === "PUT",
    );
    expect(put).toBeUndefined();
  });

  it("keeps the Boxes count read-only even in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Set-A-Watch");

    const row = screen
      .getByText("Set-A-Watch")
      .closest("tr") as HTMLElement;
    // The count renders as plain text with no editor trigger around it.
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: /Boxes/ }),
    ).not.toBeInTheDocument();
  });

  it("rolls back an optimistic edit when the PUT fails", async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (/\/api\/board-games\/\d+$/.test(url) && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse({ status: "error", message: "boom" }, { ok: false, status: 502 }),
        );
      }
      return routedFetch(url, init);
    });
    renderManager(true);
    await screen.findByText("Set-A-Watch");

    fireEvent.click(screen.getByRole("button", { name: "Set-A-Watch" }));
    const input = screen.getByRole("textbox", {
      name: "Title for Set-A-Watch",
    });
    fireEvent.change(input, { target: { value: "Doomed Edit" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // After the failed request, the original title is restored.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Set-A-Watch" }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Doomed Edit")).not.toBeInTheDocument();
  });

  it("toggles a yes/no custom field inline and PUTs the game when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("Set-A-Watch");

    const row = screen
      .getByText("Set-A-Watch")
      .closest("tr") as HTMLElement;
    // Set-A-Watch's "Has App" is true → clicking flips it to false.
    fireEvent.click(within(row).getByRole("button", { name: "Has App: Yes" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/board-games\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 10,
      );
      expect(cf.value).toBe("false");
      expect(cf.valueOptionId).toBeNull();
    });
  });

  it("shows a text custom field as plain read-only text when mass edit is off", async () => {
    renderManager(false);
    await screen.findByText("Set-A-Watch");

    expect(screen.getByText("Rock Manor Games")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Publisher" }),
    ).not.toBeInTheDocument();
  });

  it("edits a dropdown custom field inline and PUTs the game when mass edit is on", async () => {
    renderManager(true);
    await screen.findByText("Set-A-Watch");

    const row = screen
      .getByText("Set-A-Watch")
      .closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Weight" }));
    fireEvent.click(screen.getByRole("option", { name: "Heavy" }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/board-games\/1$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cf = JSON.parse(put![1].body).customFieldValues.find(
        (v: { customFieldId: number }) => v.customFieldId === 11,
      );
      expect(cf.value).toBe("Heavy");
      expect(cf.valueOptionId).toBe(22);
    });
  });
});
