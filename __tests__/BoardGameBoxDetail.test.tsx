import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { BoardGame, BoardGameBox, CustomField } from "@/lib/api";
import BoardGameBoxDetail from "@/components/board-games/BoardGameBoxDetail";
import { ToastProvider } from "@/components/ToastProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

const definitions: CustomField[] = [
  { id: 20, name: "Notes", type: "text", entityKey: "boardGameBox", order: 0, options: [] },
];
const gameDefinitions: CustomField[] = [
  { id: 9, name: "Publisher", type: "text", entityKey: "boardGame", order: 0, options: [] },
];

function slimGame(id: number, title: string, publisher?: string) {
  return {
    id,
    title,
    customFieldValues: publisher
      ? [
          {
            customFieldId: 9,
            customFieldName: "Publisher",
            customFieldType: "text" as const,
            value: publisher,
          },
        ]
      : [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  };
}

function makeBox(
  id: number,
  title: string,
  game: ReturnType<typeof slimGame>,
  overrides: Partial<BoardGameBox> = {},
): BoardGameBox {
  return {
    id,
    key: "boardGameBox",
    title,
    isExpansion: false,
    isStandAlone: true,
    baseSetId: null,
    boardGame: game,
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
    ...overrides,
  };
}

const watchGame = slimGame(41, "Set-A-Watch", "Rock Manor Games");
const jekyllGame = slimGame(42, "Jekyll vs Hyde");

const baseBox = makeBox(31, "Set-A-Watch Base Box", watchGame);
const expansionBox = makeBox(32, "Set-A-Watch Doomed Run", watchGame, {
  isExpansion: true,
  isStandAlone: false,
  baseSetId: 31,
});
const otherBox = makeBox(33, "Jekyll Box", jekyllGame);

const allBoxes = [baseBox, expansionBox, otherBox];

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
  {
    id: 42,
    key: "boardGame",
    title: "Jekyll vs Hyde",
    boardGameBoxes: [],
    customFieldValues: [],
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
  if (/\/api\/board-game-boxes\/\d+$/.test(url) && method === "PUT") {
    return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
  }
  if (url.includes("/api/board-games/search")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: games }));
  }
  return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
}

function renderDetail(box: BoardGameBox = expansionBox) {
  return render(
    <ToastProvider>
      <UiSettingsProvider initial={DEFAULT_UI_SETTINGS}>
        <BoardGameBoxDetail
          box={box}
          definitions={definitions}
          gameDefinitions={gameDefinitions}
          allBoxes={allBoxes}
        />
      </UiSettingsProvider>
    </ToastProvider>,
  );
}

function lastPut() {
  const put = [...mockFetch.mock.calls]
    .reverse()
    .find(
      ([url, init]) =>
        /\/api\/board-game-boxes\/\d+$/.test(url as string) &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
  return put ? JSON.parse((put[1] as RequestInit).body as string) : undefined;
}

describe("BoardGameBoxDetail", () => {
  beforeEach(() => {
    mockFetch.mockImplementation(routedFetch);
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("renders the fields, the base set link, and the linked game card", () => {
    renderDetail();

    expect(screen.getByRole("button", { name: "Edit Title" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expansion: Yes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stand Alone: No" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Notes" })).toBeInTheDocument();

    // The base set links to its own detail page.
    const baseList = screen.getByRole("list", { name: "Base set" });
    expect(
      within(baseList).getByRole("link", { name: "Set-A-Watch Base Box" }),
    ).toHaveAttribute("href", "/board-game-boxes/31");

    // The linked game links to its detail page and shows its values.
    const gameList = screen.getByRole("list", { name: "Board game" });
    expect(
      within(gameList).getByRole("link", { name: "Set-A-Watch" }),
    ).toHaveAttribute("href", "/board-games/41");
    expect(within(gameList).getByText("Rock Manor Games")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Back/ })).toHaveAttribute(
      "href",
      "/board-games?view=shelf",
    );
  });

  it("hides the base set card for non-expansions", () => {
    renderDetail(baseBox);
    expect(
      screen.queryByRole("list", { name: "Base set" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("searchbox", { name: "Pick a base set" }),
    ).not.toBeInTheDocument();
  });

  it("edits the title and PUTs the full box — linked game id and base set included", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Title" }));
    const input = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "Doomed Run" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(lastPut()).toEqual({
        title: "Doomed Run",
        isExpansion: true,
        isStandAlone: false,
        baseSetId: 31,
        boardGameId: 41,
        customFieldValues: [],
      });
    });
  });

  it("turning Expansion off clears the base set in the same write and hides its card", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Expansion: Yes" }));

    await waitFor(() => {
      expect(lastPut()).toEqual({
        title: "Set-A-Watch Doomed Run",
        isExpansion: false,
        isStandAlone: false,
        baseSetId: null,
        boardGameId: 41,
        customFieldValues: [],
      });
    });
    expect(
      screen.queryByRole("list", { name: "Base set" }),
    ).not.toBeInTheDocument();
  });

  it("clears the base set with the X and persists null", async () => {
    renderDetail();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Set-A-Watch Base Box" }),
    );

    await waitFor(() => {
      expect(lastPut()).toMatchObject({ baseSetId: null, boardGameId: 41 });
    });
    expect(screen.getByText("No base set picked.")).toBeInTheDocument();
  });

  it("picks a new base set by id through the picker (self excluded)", async () => {
    renderDetail();

    const picker = screen.getByRole("searchbox", { name: "Pick a base set" });
    fireEvent.change(picker, { target: { value: "box" } });

    const results = screen.getByRole("list", { name: "Matching boxes" });
    // The box itself ("Set-A-Watch Doomed Run") never appears; the current
    // base set is hidden too.
    expect(
      within(results).queryByText("Set-A-Watch Doomed Run"),
    ).not.toBeInTheDocument();
    expect(
      within(results).queryByText("Set-A-Watch Base Box"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(results).getByRole("button", { name: /^Jekyll Box/ }),
    );

    await waitFor(() => {
      expect(lastPut()).toMatchObject({ baseSetId: 33, boardGameId: 41 });
    });
    // The card now shows (and links) the new base set.
    const baseList = screen.getByRole("list", { name: "Base set" });
    expect(
      within(baseList).getByRole("link", { name: "Jekyll Box" }),
    ).toHaveAttribute("href", "/board-game-boxes/33");
  });

  it("relinks the box to another game through the lazy-loaded picker", async () => {
    renderDetail();

    const picker = screen.getByRole("searchbox", {
      name: "Change the linked game",
    });
    fireEvent.focus(picker);
    // The game list loads once, lazily.
    await waitFor(() =>
      expect(
        mockFetch.mock.calls.some(([url]) =>
          String(url).includes("/api/board-games/search"),
        ),
      ).toBe(true),
    );

    fireEvent.change(picker, { target: { value: "jekyll" } });
    const results = await screen.findByRole("list", {
      name: "Matching games",
    });
    fireEvent.click(
      within(results).getByRole("button", { name: "Jekyll vs Hyde" }),
    );

    await waitFor(() => {
      expect(lastPut()).toMatchObject({ boardGameId: 42 });
    });
    // The game card re-rendered with the new link target.
    const gameList = screen.getByRole("list", { name: "Board game" });
    expect(
      within(gameList).getByRole("link", { name: "Jekyll vs Hyde" }),
    ).toHaveAttribute("href", "/board-games/42");
  });

  it("rolls back the optimistic edit when the PUT fails", async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        /\/api\/board-game-boxes\/\d+$/.test(url) &&
        init?.method === "PUT"
      ) {
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

    fireEvent.click(screen.getByRole("button", { name: "Expansion: Yes" }));

    await screen.findByText(/Couldn't update the board game box/);
    // The flag (and the base set card) are back.
    expect(
      screen.getByRole("button", { name: "Expansion: Yes" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Base set" })).toBeInTheDocument();
  });
});
