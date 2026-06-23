import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useRouter } from "next/navigation";
import type {
  BoardGame,
  BoardGameBox,
  CustomField,
  FilterRequestDto,
  FilterSpecification,
} from "@/lib/api";
import BoardGameBoxesManager from "@/components/board-games/BoardGameBoxesManager";
import { ToastProvider } from "@/components/ToastProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));
const mockPush = jest.fn();

const boxFields: CustomField[] = [
  { id: 20, name: "Notes", type: "text", entityKey: "boardGameBox", order: 0, options: [] },
];
const gameFields: CustomField[] = [];

function slimGame(id: number, title: string) {
  return {
    id,
    title,
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  };
}

const boxes: BoardGameBox[] = [
  {
    id: 31,
    key: "boardGameBox",
    title: "Set-A-Watch Base Box",
    isExpansion: false,
    isStandAlone: true,
    baseSetId: null,
    boardGame: slimGame(41, "Set-A-Watch"),
    customFieldValues: [
      { customFieldId: 20, customFieldName: "Notes", customFieldType: "text", value: "Sleeved", valueOptionId: null },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 32,
    key: "boardGameBox",
    title: "Set-A-Watch Doomed Run",
    isExpansion: true,
    isStandAlone: false,
    baseSetId: 31,
    boardGame: slimGame(41, "Set-A-Watch"),
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 33,
    key: "boardGameBox",
    title: "Jekyll Box",
    isExpansion: false,
    isStandAlone: true,
    baseSetId: null,
    boardGame: slimGame(42, "Jekyll vs Hyde"),
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

const games: BoardGame[] = [
  {
    id: 41,
    key: "boardGame",
    title: "Set-A-Watch",
    boardGameBoxes: [],
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

// Mirrors the live /filters/boardGameBox response: title + the two expansion
// flags + timestamps plus the sort/pagination pseudo-fields the field list
// drops. No relationship (system-kind) filter fields.
const filterSpec: FilterSpecification = {
  type: "boardGameBox_filters",
  fields: {
    title: "text",
    is_expansion: "boolean",
    is_stand_alone: "boolean",
    created_at: "time",
    updated_at: "time",
    all_fields: "sort",
    pagination_fields: "pagination",
  },
  filters: {
    title: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    is_expansion: ["equals"],
    is_stand_alone: ["equals"],
    created_at: ["since", "before"],
    updated_at: ["since", "before"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
  },
};

// A tiny stand-in for the backend's filter matching, enough to exercise the
// server-search wiring.
function matchOne(box: BoardGameBox, f: FilterRequestDto): boolean {
  const raw =
    f.field === "title"
      ? box.title
      : f.field === "is_expansion"
        ? String(box.isExpansion)
        : f.field === "is_stand_alone"
          ? String(box.isStandAlone)
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
    default:
      return true;
  }
}

function applyFilters(
  list: BoardGameBox[],
  filters: FilterRequestDto[],
): BoardGameBox[] {
  return (filters ?? []).reduce(
    (out, f) => out.filter((b) => matchOne(b, f)),
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
  if (/\/api\/board-game-boxes\/\d+$/.test(url) && method === "PUT") {
    return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
  }
  if (/\/api\/board-game-boxes\/\d+$/.test(url) && method === "DELETE") {
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }
  if (url === "/api/board-game-boxes" && method === "POST") {
    const input = init?.body ? JSON.parse(init.body as string) : {};
    const created: BoardGameBox = {
      id: 99,
      key: "boardGameBox",
      title: input.title,
      isExpansion: input.isExpansion,
      isStandAlone: input.isStandAlone,
      baseSetId: input.baseSetId,
      boardGame: input.boardGame
        ? slimGame(98, input.boardGame.title)
        : slimGame(input.boardGameId, "Set-A-Watch"),
      customFieldValues: input.customFieldValues ?? [],
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    };
    return Promise.resolve(jsonResponse({ status: "ok", data: created }));
  }
  if (url.includes("/api/filters/boardGameBox")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: filterSpec }));
  }
  if (url.includes("/entity/boardGameBox")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: boxFields }));
  }
  if (url.includes("/entity/boardGame")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: gameFields }));
  }
  if (url.includes("/api/board-game-boxes/search")) {
    const body = init?.body ? JSON.parse(init.body as string) : { filters: [] };
    return Promise.resolve(
      jsonResponse({ status: "ok", data: applyFilters(boxes, body.filters) }),
    );
  }
  if (url.includes("/api/board-games/search")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: games }));
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
        <BoardGameBoxesManager />
      </UiSettingsProvider>
    </ToastProvider>,
  );
}

describe("BoardGameBoxesManager", () => {
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

  it("hides only the standard columns turned off in the settings", async () => {
    renderManager(false, {
      ...DEFAULT_UI_SETTINGS.standardFields,
      boardGameBox: {
        boardGame: true,
        expansion: false,
        standAlone: true,
        baseSet: false,
      },
    });
    await screen.findByText("Set-A-Watch Doomed Run");

    expect(
      screen.getByRole("columnheader", { name: "Title" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Board Game" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Expansion" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Stand Alone" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Base Set" }),
    ).not.toBeInTheDocument();
  });

  it("loads the boxes with a count and the Title + Board Game + flags + Base Set + custom-field columns", async () => {
    renderManager();

    expect(await screen.findByText("Set-A-Watch Doomed Run")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "3 Board Game Boxes" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("columnheader", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Board Game" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Expansion" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Stand Alone" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Base Set" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Notes" })).toBeInTheDocument();
  });

  it("shows each box's game, flags, and resolved base-set title (or a dash)", async () => {
    renderManager();
    await screen.findByText("Set-A-Watch Doomed Run");

    const expansionRow = screen
      .getByText("Set-A-Watch Doomed Run")
      .closest("tr") as HTMLElement;
    // The linked game's title, and the base set's title resolved from its id
    // against the box list.
    expect(within(expansionRow).getByText("Set-A-Watch")).toBeInTheDocument();
    expect(
      within(expansionRow).getByText("Set-A-Watch Base Box"),
    ).toBeInTheDocument();
    // Expansion: Yes, Stand Alone: No.
    expect(within(expansionRow).getByRole("img", { name: "Yes" })).toBeInTheDocument();
    expect(within(expansionRow).getByRole("img", { name: "No" })).toBeInTheDocument();

    const jekyllRow = screen
      .getByText("Jekyll vs Hyde")
      .closest("tr") as HTMLElement;
    // No base set → dash (the empty Notes cell renders one too).
    expect(within(jekyllRow).getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("keeps resolving base-set titles after a filter hides the base set's own row", async () => {
    renderManager();
    await screen.findByText("Set-A-Watch Doomed Run");

    const box = screen.getByRole("searchbox", {
      name: "Search board game boxes",
    });
    fireEvent.change(box, { target: { value: "doomed" } });
    fireEvent.keyDown(box, { key: "Enter" });

    // Only the expansion remains visible...
    await waitFor(() =>
      expect(screen.queryByText("Jekyll vs Hyde")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "1 Board Game Box" }),
    ).toBeInTheDocument();

    // ...but its Base Set cell still shows the (now hidden) base set's title,
    // resolved from the mount-time unfiltered list.
    const row = screen
      .getByText("Set-A-Watch Doomed Run")
      .closest("tr") as HTMLElement;
    expect(within(row).getByText("Set-A-Watch Base Box")).toBeInTheDocument();
  });

  it("offers a New button but no per-row delete controls", async () => {
    renderManager();
    await screen.findByText("Set-A-Watch Doomed Run");

    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add filter" })).toBeInTheDocument();

    // Delete moved off the grid row and onto the box detail page.
    expect(
      screen.queryByRole("button", { name: "Delete Jekyll Box" }),
    ).not.toBeInTheDocument();
  });

  it("creates a box through the New dialog, POSTing the payload and prepending the row", async () => {
    renderManager();
    await screen.findByText("Set-A-Watch Doomed Run");

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    const dialog = screen.getByRole("dialog", {
      name: "Create Board Game Box",
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Edit Title" }));
    const input = within(dialog).getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "Wingspan" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Queue the box's game through the stacked dialog.
    fireEvent.click(screen.getByRole("button", { name: "Add New Game" }));
    const gameDialog = screen.getByRole("dialog", {
      name: "Create Board Game",
    });
    fireEvent.click(
      within(gameDialog).getByRole("button", { name: "Edit Title" }),
    );
    const gameInput = within(gameDialog).getByRole("textbox", {
      name: "Title",
    });
    fireEvent.change(gameInput, { target: { value: "Wingspan" } });
    fireEvent.keyDown(gameInput, { key: "Enter" });
    fireEvent.click(
      within(gameDialog).getByRole("button", { name: "Create" }),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Create Board Game Box" }),
      ).not.toBeInTheDocument(),
    );
    // The POST carried the inline new game...
    const post = mockFetch.mock.calls.find(
      ([url, init]) =>
        url === "/api/board-game-boxes" && init?.method === "POST",
    );
    expect(post).toBeDefined();
    expect(JSON.parse(post![1].body)).toEqual({
      title: "Wingspan",
      isExpansion: false,
      isStandAlone: true,
      baseSetId: null,
      boardGameId: null,
      boardGame: { title: "Wingspan", customFieldValues: [] },
      customFieldValues: [],
    });
    // ...and the created row (with its backend-assigned data) leads the grid.
    // "Wingspan" shows in both the Title and Board Game cells.
    expect((await screen.findAllByText("Wingspan")).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("heading", { level: 2, name: "4 Board Game Boxes" }),
    ).toBeInTheDocument();
  });

  it("navigates to a box's detail route when its row is clicked (mass edit off)", async () => {
    renderManager(false);
    await screen.findByText("Jekyll vs Hyde");

    fireEvent.click(screen.getByText("Jekyll vs Hyde"));

    expect(mockPush).toHaveBeenCalledWith("/board-game-boxes/33");
  });

  it("navigates from the open-details button in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Jekyll vs Hyde");

    const row = screen.getByText("Jekyll vs Hyde").closest("tr");
    fireEvent.click(
      within(row as HTMLElement).getByRole("button", {
        name: "View Jekyll Box",
      }),
    );

    expect(mockPush).toHaveBeenCalledWith("/board-game-boxes/33");
  });

  it("inline-edits a box's title and PUTs the full box — linked game id included", async () => {
    renderManager(true);
    await screen.findByText("Set-A-Watch Doomed Run");

    fireEvent.click(
      screen.getByRole("button", { name: "Set-A-Watch Doomed Run" }),
    );
    const input = screen.getByRole("textbox", {
      name: "Title for Set-A-Watch Doomed Run",
    });
    fireEvent.change(input, { target: { value: "Doomed Run" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("Doomed Run")).toBeInTheDocument();

    const put = mockFetch.mock.calls.find(
      ([url, init]) =>
        /\/api\/board-game-boxes\/32$/.test(url) && init?.method === "PUT",
    );
    expect(put).toBeDefined();
    expect(JSON.parse(put![1].body)).toEqual({
      title: "Doomed Run",
      isExpansion: true,
      isStandAlone: false,
      baseSetId: 31,
      boardGameId: 41,
      customFieldValues: [],
    });
  });

  it("turning Expansion off through the inline editor also nulls the base set", async () => {
    renderManager(true);
    await screen.findByText("Set-A-Watch Doomed Run");

    const row = screen
      .getByText("Set-A-Watch Doomed Run")
      .closest("tr") as HTMLElement;
    fireEvent.click(
      within(row).getByRole("button", { name: "Expansion: Yes" }),
    );

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/board-game-boxes\/32$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      expect(JSON.parse(put![1].body)).toEqual({
        title: "Set-A-Watch Doomed Run",
        isExpansion: false,
        isStandAlone: false,
        baseSetId: null,
        boardGameId: 41,
        customFieldValues: [],
      });
    });
  });

  it("keeps the Board Game column read-only even in mass edit mode", async () => {
    renderManager(true);
    await screen.findByText("Set-A-Watch Doomed Run");

    const row = screen
      .getByText("Set-A-Watch Doomed Run")
      .closest("tr") as HTMLElement;
    expect(
      within(row).queryByRole("button", { name: "Board Game" }),
    ).not.toBeInTheDocument();
  });

  it("rolls back an optimistic edit when the PUT fails", async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (/\/api\/board-game-boxes\/\d+$/.test(url) && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse(
            { status: "error", message: "boom" },
            { ok: false, status: 502 },
          ),
        );
      }
      return routedFetch(url, init);
    });
    renderManager(true);
    await screen.findByText("Set-A-Watch Doomed Run");

    fireEvent.click(
      screen.getByRole("button", { name: "Set-A-Watch Doomed Run" }),
    );
    const input = screen.getByRole("textbox", {
      name: "Title for Set-A-Watch Doomed Run",
    });
    fireEvent.change(input, { target: { value: "Doomed Edit" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Set-A-Watch Doomed Run" }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Doomed Edit")).not.toBeInTheDocument();
  });

  it("filters by the is_expansion boolean field and sends the operand", async () => {
    renderManager();
    await screen.findByText("Set-A-Watch Doomed Run");

    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Filter field" }));
    fireEvent.click(screen.getByRole("option", { name: "Is Expansion" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    // Only the expansion remains.
    await waitFor(() =>
      expect(screen.queryByText("Jekyll vs Hyde")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Set-A-Watch Doomed Run")).toBeInTheDocument();

    const search = mockFetch.mock.calls.find(
      ([url, init]) =>
        url.includes("/api/board-game-boxes/search") &&
        init?.method === "POST" &&
        (init.body as string).includes("is_expansion"),
    );
    expect(search).toBeDefined();
    expect(JSON.parse(search![1].body).filters).toEqual([
      {
        key: "boardGameBox",
        field: "is_expansion",
        operator: "equals",
        operand: "true",
      },
    ]);
  });
});
