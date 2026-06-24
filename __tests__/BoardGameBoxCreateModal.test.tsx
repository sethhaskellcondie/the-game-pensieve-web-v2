import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { BoardGame, BoardGameBox, CustomField } from "@/lib/api";
import BoardGameBoxCreateModal from "@/components/board-games/BoardGameBoxCreateModal";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

// No box custom fields needed; the standard Title/Expansion/Stand Alone rows
// plus the base-set and game sections are what these behaviors exercise.
const definitions: CustomField[] = [];
const gameDefinitions: CustomField[] = [];

function makeGame(id: number, title: string, boxTitles: string[] = []): BoardGame {
  return {
    id,
    key: "boardGame",
    title,
    boardGameBoxes: boxTitles.map((t, i) => ({
      id: 100 + i,
      title: t,
      isExpansion: false,
      isStandAlone: true,
      baseSetId: null,
      customFieldValues: [],
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    })),
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  };
}

function makeBox(id: number, title: string, game: BoardGame): BoardGameBox {
  return {
    id,
    key: "boardGameBox",
    title,
    isExpansion: false,
    isStandAlone: true,
    baseSetId: null,
    boardGame: {
      id: game.id,
      title: game.title,
      customFieldValues: [],
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    },
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  };
}

const catan = makeGame(41, "Settlers of Catan", ["Settlers of Catan"]);
const jekyll = makeGame(42, "Jekyll vs Hyde");
const existingGames: BoardGame[] = [catan, jekyll];
const existingBoxes: BoardGameBox[] = [
  makeBox(71, "Settlers of Catan", catan),
  makeBox(72, "Jekyll vs Hyde", jekyll),
];

const mockFetch = jest.fn();

function routedFetch(url: string) {
  const data = url.includes("/api/board-game-boxes/search")
    ? existingBoxes
    : existingGames;
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ status: "ok", data }),
    text: async () => "{}",
  } as unknown as Response);
}

function renderModal({
  massInputMode = false,
  lockedGame,
  onCreate = jest.fn().mockResolvedValue(true),
  onClose = jest.fn(),
}: {
  massInputMode?: boolean;
  lockedGame?: { id: number; title: string };
  onCreate?: jest.Mock;
  onClose?: jest.Mock;
} = {}) {
  render(
    <UiSettingsProvider initial={{ ...DEFAULT_UI_SETTINGS, massInputMode }}>
      <BoardGameBoxCreateModal
        definitions={definitions}
        gameDefinitions={gameDefinitions}
        saving={false}
        lockedGame={lockedGame}
        onCreate={onCreate}
        onClose={onClose}
      />
    </UiSettingsProvider>,
  );
  return { onCreate, onClose };
}

const boxDialog = () =>
  screen.getByRole("dialog", { name: "Create Board Game Box" });
const gameDialog = () =>
  screen.getByRole("dialog", { name: "Create Board Game" });

// Drive the Title editor inside `scope`. The box dialog auto-opens Title on
// mount (no Edit button to click); the stacked game dialog still needs the
// click — so open it only when the button is present.
function typeTitle(scope: HTMLElement, value: string) {
  const editButton = within(scope).queryByRole("button", { name: "Edit Title" });
  if (editButton) fireEvent.click(editButton);
  const input = within(scope).getByRole("textbox", { name: "Title" });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

// Queue a new game through the stacked dialog.
function addNewGame(title: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add New Game" }));
  const dialog = gameDialog();
  typeTitle(dialog, title);
  fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
}

// Pick an existing game through the picker.
async function pickExistingGame(query: string, resultName: RegExp) {
  const picker = screen.getByRole("searchbox", {
    name: "Pick an existing game",
  });
  fireEvent.focus(picker);
  fireEvent.change(picker, { target: { value: query } });
  const results = await screen.findByRole("list", { name: "Matching games" });
  fireEvent.click(within(results).getByRole("button", { name: resultName }));
}

// Pick a base set box through its picker (Expansion must be on).
async function pickBaseSet(query: string, resultName: RegExp) {
  const picker = screen.getByRole("searchbox", { name: "Pick a base set" });
  fireEvent.focus(picker);
  fireEvent.change(picker, { target: { value: query } });
  const results = await screen.findByRole("list", { name: "Matching boxes" });
  fireEvent.click(within(results).getByRole("button", { name: resultName }));
}

describe("BoardGameBoxCreateModal", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(routedFetch);
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("keeps Create disabled until the box has a title and a game", () => {
    renderModal();
    const create = screen.getByRole("button", { name: "Create" });

    typeTitle(boxDialog(), "Settlers of Catan");
    // A title alone isn't enough — a box holds exactly one game.
    expect(screen.getByText("Pick or create the game.")).toBeInTheDocument();
    expect(create).toBeDisabled();

    addNewGame("Settlers of Catan");
    expect(create).toBeEnabled();

    // Clearing the game disables Create again.
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Settlers of Catan" }),
    );
    expect(create).toBeDisabled();
  });

  it("queues a new game via the stacked dialog without any network call", () => {
    renderModal();
    typeTitle(boxDialog(), "Settlers of Catan");

    addNewGame("Settlers of Catan");

    const list = screen.getByRole("list", { name: "Board game for this box" });
    const row = within(list).getAllByRole("listitem")[0];
    expect(row).toHaveTextContent("Settlers of Catan");
    expect(row).toHaveTextContent("New");
    // Selecting is local — nothing was persisted.
    expect(mockFetch).not.toHaveBeenCalled();
    // With the game chosen, the add/pick affordances go away.
    expect(
      screen.queryByRole("button", { name: "Add New Game" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("searchbox", { name: "Pick an existing game" }),
    ).not.toBeInTheDocument();
  });

  it("picks an existing game through the picker, with its shelf hint", async () => {
    renderModal();

    const picker = screen.getByRole("searchbox", {
      name: "Pick an existing game",
    });
    fireEvent.focus(picker);
    // The list loads once, lazily, from the games search.
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch.mock.calls[0][0]).toBe("/api/board-games/search");

    fireEvent.change(picker, { target: { value: "catan" } });
    const results = await screen.findByRole("list", { name: "Matching games" });
    // Title-contains filtering: Jekyll is out; the shelved game says where.
    expect(within(results).queryByText("Jekyll vs Hyde")).not.toBeInTheDocument();
    expect(
      within(results).getByText("in Settlers of Catan"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(results).getByRole("button", { name: /^Settlers of Catan/ }),
    );

    const list = screen.getByRole("list", { name: "Board game for this box" });
    const row = within(list).getAllByRole("listitem")[0];
    expect(row).toHaveTextContent("Settlers of Catan");
    expect(row).toHaveTextContent("Existing");
  });

  it("submits an existing game as boardGameId with no inline boardGame", async () => {
    const { onCreate, onClose } = renderModal();
    typeTitle(boxDialog(), "  Settlers of Catan (2nd Copy)  ");
    await pickExistingGame("catan", /^Settlers of Catan/);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      title: "Settlers of Catan (2nd Copy)",
      isExpansion: false,
      isStandAlone: true,
      baseSetId: null,
      boardGameId: 41,
      boardGame: null,
      customFieldValues: [],
    });
  });

  it("submits a new game inline as boardGame with boardGameId null", async () => {
    const { onCreate, onClose } = renderModal();
    typeTitle(boxDialog(), "Wingspan");
    // Stand Alone starts true; flip it to exercise the toggle.
    fireEvent.click(
      within(boxDialog()).getByRole("button", { name: "Stand Alone: Yes" }),
    );
    addNewGame("Wingspan");

    // The stacked dialog may still be unmounting; scope to the box dialog so
    // its Create button is unambiguous.
    fireEvent.click(
      within(boxDialog()).getByRole("button", { name: "Create" }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      title: "Wingspan",
      isExpansion: false,
      isStandAlone: false,
      baseSetId: null,
      boardGameId: null,
      boardGame: { title: "Wingspan", customFieldValues: [] },
      customFieldValues: [],
    });
  });

  it("shows the base-set section only while Expansion is on", () => {
    renderModal();
    expect(
      screen.queryByRole("searchbox", { name: "Pick a base set" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(boxDialog()).getByRole("button", { name: "Expansion: No" }),
    );
    expect(
      screen.getByRole("searchbox", { name: "Pick a base set" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(boxDialog()).getByRole("button", { name: "Expansion: Yes" }),
    );
    expect(
      screen.queryByRole("searchbox", { name: "Pick a base set" }),
    ).not.toBeInTheDocument();
  });

  it("auto-defaults the game from the picked base set and submits both ids", async () => {
    const { onCreate, onClose } = renderModal();
    typeTitle(boxDialog(), "Catan: Cities & Knights");
    fireEvent.click(
      within(boxDialog()).getByRole("button", { name: "Expansion: No" }),
    );

    await pickBaseSet("catan", /^Settlers of Catan/);

    // The game section filled itself with the base set's game.
    const list = screen.getByRole("list", { name: "Board game for this box" });
    expect(within(list).getByText("Settlers of Catan")).toBeInTheDocument();
    expect(within(list).getByText("Existing")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      title: "Catan: Cities & Knights",
      isExpansion: true,
      isStandAlone: true,
      baseSetId: 71,
      boardGameId: 41,
      boardGame: null,
      customFieldValues: [],
    });
  });

  it("never overrides a deliberately chosen game with the base set's game", async () => {
    renderModal();
    typeTitle(boxDialog(), "Some Crossover Expansion");
    await pickExistingGame("jekyll", /^Jekyll vs Hyde/);

    fireEvent.click(
      within(boxDialog()).getByRole("button", { name: "Expansion: No" }),
    );
    await pickBaseSet("catan", /^Settlers of Catan/);

    // The picked game survives the base-set choice.
    const list = screen.getByRole("list", { name: "Board game for this box" });
    expect(within(list).getByText("Jekyll vs Hyde")).toBeInTheDocument();
    expect(
      within(list).queryByText("Settlers of Catan"),
    ).not.toBeInTheDocument();
  });

  it("unchecking Expansion clears the base set and an auto-defaulted game", async () => {
    renderModal();
    fireEvent.click(
      within(boxDialog()).getByRole("button", { name: "Expansion: No" }),
    );
    await pickBaseSet("catan", /^Settlers of Catan/);
    expect(
      within(
        screen.getByRole("list", { name: "Board game for this box" }),
      ).getByText("Settlers of Catan"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(boxDialog()).getByRole("button", { name: "Expansion: Yes" }),
    );

    // Base set section is gone, and the never-touched game went with it.
    expect(
      screen.queryByRole("searchbox", { name: "Pick a base set" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Pick or create the game.")).toBeInTheDocument();
  });

  it("locks the game section to the caller's game and submits its id", async () => {
    const { onCreate, onClose } = renderModal({
      lockedGame: { id: 42, title: "Jekyll vs Hyde" },
    });

    // The game is fixed: no picker, no add button, no remove control.
    const list = screen.getByRole("list", { name: "Board game for this box" });
    expect(within(list).getByText("Jekyll vs Hyde")).toBeInTheDocument();
    expect(within(list).getByText("Linked")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add New Game" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("searchbox", { name: "Pick an existing game" }),
    ).not.toBeInTheDocument();
    expect(
      within(list).queryByRole("button", { name: /^Remove / }),
    ).not.toBeInTheDocument();

    typeTitle(boxDialog(), "Jekyll vs Hyde (Travel Edition)");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      title: "Jekyll vs Hyde (Travel Edition)",
      isExpansion: false,
      isStandAlone: true,
      baseSetId: null,
      boardGameId: 42,
      boardGame: null,
      customFieldValues: [],
    });
  });

  it("Escape closes only the stacked dialog first, then the box dialog", () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Add New Game" }));
    expect(gameDialog()).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Create Board Game" }),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe("mass-input mode", () => {
    it("resets the whole form — game and base set included — after a create", async () => {
      const { onCreate, onClose } = renderModal({ massInputMode: true });
      typeTitle(boxDialog(), "Catan: Cities & Knights");
      fireEvent.click(
        within(boxDialog()).getByRole("button", { name: "Expansion: No" }),
      );
      await pickBaseSet("catan", /^Settlers of Catan/);

      fireEvent.click(
        screen.getByRole("button", { name: "Create And Add Another" }),
      );

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
      // Still open, with the form back at its defaults.
      expect(onClose).not.toHaveBeenCalled();
      expect(boxDialog()).toBeVisible();
      await waitFor(() =>
        expect(
          screen.getByText("Pick or create the game."),
        ).toBeInTheDocument(),
      );
      expect(
        within(boxDialog()).getByRole("button", { name: "Expansion: No" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Catan: Cities & Knights"),
      ).not.toBeInTheDocument();
    });

    it("does not close on Escape; the close button still exits", () => {
      const { onClose } = renderModal({ massInputMode: true });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
