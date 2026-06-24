import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { BoardGame, CustomField } from "@/lib/api";
import BoardGameDetail from "@/components/board-games/BoardGameDetail";
import { ToastProvider } from "@/components/ToastProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

const definitions: CustomField[] = [
  { id: 9, name: "Publisher", type: "text", entityKey: "boardGame", order: 0, options: [] },
];
const boxDefinitions: CustomField[] = [
  { id: 20, name: "Notes", type: "text", entityKey: "boardGameBox", order: 0, options: [] },
];

const game: BoardGame = {
  id: 41,
  key: "boardGame",
  title: "Set-A-Watch",
  boardGameBoxes: [
    {
      id: 31,
      title: "Set-A-Watch Base Box",
      isExpansion: false,
      isStandAlone: true,
      baseSetId: null,
      customFieldValues: [
        { customFieldId: 20, customFieldName: "Notes", customFieldType: "text", value: "Sleeved", valueOptionId: null },
      ],
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
    { customFieldId: 9, customFieldName: "Publisher", customFieldType: "text", value: "Rock Manor Games", valueOptionId: null },
  ],
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
};

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
  if (/\/api\/board-games\/\d+$/.test(url) && method === "PUT") {
    return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
  }
  if (url === "/api/board-game-boxes" && method === "POST") {
    const input = init?.body ? JSON.parse(init.body as string) : {};
    return Promise.resolve(
      jsonResponse({
        status: "ok",
        data: {
          id: 99,
          key: "boardGameBox",
          title: input.title,
          isExpansion: input.isExpansion,
          isStandAlone: input.isStandAlone,
          baseSetId: input.baseSetId,
          boardGame: {
            id: 41,
            title: "Set-A-Watch",
            customFieldValues: [],
            createdAt: "",
            updatedAt: "",
            deletedAt: null,
          },
          customFieldValues: input.customFieldValues ?? [],
          createdAt: "",
          updatedAt: "",
          deletedAt: null,
        },
      }),
    );
  }
  return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
}

function renderDetail() {
  return render(
    <ToastProvider>
      <UiSettingsProvider initial={DEFAULT_UI_SETTINGS}>
        <BoardGameDetail
          game={game}
          definitions={definitions}
          boxDefinitions={boxDefinitions}
        />
      </UiSettingsProvider>
    </ToastProvider>,
  );
}

describe("BoardGameDetail", () => {
  beforeEach(() => {
    mockFetch.mockImplementation(routedFetch);
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("renders the fields card and the boxes chart with links, flags, and base-set resolution", () => {
    renderDetail();

    // Fields: Title + the boardGame custom field.
    expect(screen.getByRole("button", { name: "Edit Title" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Publisher" })).toBeInTheDocument();

    // The chart: one row per box, title linking to its detail page.
    const list = screen.getByRole("list", { name: "Board game boxes" });
    expect(
      within(list).getByRole("link", { name: "Set-A-Watch Base Box" }),
    ).toHaveAttribute("href", "/board-game-boxes/31");
    expect(
      within(list).getByRole("link", { name: "Set-A-Watch Doomed Run" }),
    ).toHaveAttribute("href", "/board-game-boxes/32");

    // The expansion is flagged, and its base set resolves to a sibling box.
    const expansionRow = within(list)
      .getByRole("link", { name: "Set-A-Watch Doomed Run" })
      .closest("li") as HTMLElement;
    expect(within(expansionRow).getByText("Expansion")).toBeInTheDocument();
    expect(
      within(expansionRow).getByText("Set-A-Watch Base Box"),
    ).toBeInTheDocument();

    // Box custom-field values render in the grid.
    expect(within(list).getByText("Sleeved")).toBeInTheDocument();

    // The back button returns to the list view explicitly.
    expect(screen.getByRole("link", { name: /Back/ })).toHaveAttribute(
      "href",
      "/board-games?view=list",
    );
  });

  it("edits the title and PUTs the full game", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Title" }));
    const input = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "Set-A-Watch (2nd Ed.)" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(
        ([url, init]) =>
          /\/api\/board-games\/41$/.test(url) && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      expect(JSON.parse(put![1].body)).toEqual({
        title: "Set-A-Watch (2nd Ed.)",
        customFieldValues: game.customFieldValues,
      });
    });
  });

  it("rolls back the optimistic edit when the PUT fails", async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (/\/api\/board-games\/\d+$/.test(url) && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse(
            { status: "error", message: "boom" },
            { ok: false, status: 502 },
          ),
        );
      }
      return routedFetch(url, init);
    });
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Title" }));
    const input = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "Doomed Edit" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await screen.findByText(/Couldn't update the board game/);
    expect(screen.queryByText("Doomed Edit")).not.toBeInTheDocument();
  });

  it("creates a box for this game through the locked dialog and appends it to the chart", async () => {
    renderDetail();

    fireEvent.click(
      screen.getByRole("button", { name: /New Board Game Box/ }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Create Board Game Box",
    });

    // The game section is locked to this game — no picker, no add button.
    expect(within(dialog).getByText("Linked")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Add New Game" }),
    ).not.toBeInTheDocument();

    // The box dialog auto-opens its Title editor on mount — no Edit button.
    const input = within(dialog).getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "Set-A-Watch Travel Box" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Create Board Game Box" }),
      ).not.toBeInTheDocument(),
    );

    // The POST carried this game's id.
    const post = mockFetch.mock.calls.find(
      ([url, init]) =>
        url === "/api/board-game-boxes" && init?.method === "POST",
    );
    expect(post).toBeDefined();
    expect(JSON.parse(post![1].body)).toEqual({
      title: "Set-A-Watch Travel Box",
      isExpansion: false,
      isStandAlone: true,
      baseSetId: null,
      boardGameId: 41,
      boardGame: null,
      customFieldValues: [],
    });

    // The created box joined the chart.
    const list = screen.getByRole("list", { name: "Board game boxes" });
    expect(
      within(list).getByRole("link", { name: "Set-A-Watch Travel Box" }),
    ).toHaveAttribute("href", "/board-game-boxes/99");
  });
});
