import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { CustomField, System, VideoGame } from "@/lib/api";
import VideoGameBoxCreateModal from "@/components/video-games/VideoGameBoxCreateModal";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

const systems: System[] = [
  { id: 1, key: "system", name: "NES", generation: 3, handheld: false, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
  { id: 2, key: "system", name: "SNES", generation: 4, handheld: false, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
];

// No box custom fields needed; the standard Title/System/Physical rows plus
// the games section are what these behaviors exercise.
const definitions: CustomField[] = [];
const gameDefinitions: CustomField[] = [];

function makeGame(id: number, title: string, boxTitles: string[] = []): VideoGame {
  return {
    id,
    key: "videoGame",
    title,
    system: systems[0],
    videoGameBoxes: boxTitles.map((t, i) => ({ id: 100 + i, title: t })),
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  };
}

const existingGames: VideoGame[] = [
  makeGame(41, "Mega Man 2"),
  makeGame(42, "Mega Man 3", ["Mega Man Legacy Collection"]),
  makeGame(43, "Castlevania"),
];

const mockFetch = jest.fn();

function renderModal({
  massInputMode = false,
  onCreate = jest.fn().mockResolvedValue(true),
  onClose = jest.fn(),
}: {
  massInputMode?: boolean;
  onCreate?: jest.Mock;
  onClose?: jest.Mock;
} = {}) {
  render(
    <UiSettingsProvider initial={{ ...DEFAULT_UI_SETTINGS, massInputMode }}>
      <VideoGameBoxCreateModal
        definitions={definitions}
        gameDefinitions={gameDefinitions}
        systems={systems}
        saving={false}
        onCreate={onCreate}
        onClose={onClose}
      />
    </UiSettingsProvider>,
  );
  return { onCreate, onClose };
}

const boxDialog = () =>
  screen.getByRole("dialog", { name: "Create Video Game Box" });
const gameDialog = () =>
  screen.getByRole("dialog", { name: "Create Video Game" });

// Drive the click-to-edit Title editor inside `scope`.
function typeTitle(scope: HTMLElement, value: string) {
  fireEvent.click(within(scope).getByRole("button", { name: "Edit Title" }));
  const input = within(scope).getByRole("textbox", { name: "Title" });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

function pickSystem(scope: HTMLElement, name: string) {
  fireEvent.click(within(scope).getByRole("button", { name: "System" }));
  fireEvent.click(within(scope).getByRole("option", { name }));
}

// Queue a new game through the stacked dialog.
function addNewGame(title: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add New Game" }));
  const dialog = gameDialog();
  typeTitle(dialog, title);
  fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
}

// Attach an existing game through the picker.
async function addExistingGame(query: string, resultName: RegExp) {
  const picker = screen.getByRole("searchbox", {
    name: "Add an existing game",
  });
  fireEvent.focus(picker);
  fireEvent.change(picker, { target: { value: query } });
  const results = await screen.findByRole("list", { name: "Matching games" });
  fireEvent.click(within(results).getByRole("button", { name: resultName }));
}

describe("VideoGameBoxCreateModal", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok", data: existingGames }),
      text: async () => "{}",
    } as unknown as Response);
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("keeps Create disabled until the box holds at least one game", () => {
    renderModal();
    const create = screen.getByRole("button", { name: "Create" });

    typeTitle(boxDialog(), "Mega Man Collection");
    pickSystem(boxDialog(), "NES");
    // Title + system alone aren't enough — a box needs a game.
    expect(screen.getByText("Add at least one game.")).toBeInTheDocument();
    expect(create).toBeDisabled();

    addNewGame("Mega Man");
    expect(create).toBeEnabled();

    // Removing the only game disables Create again.
    fireEvent.click(screen.getByRole("button", { name: "Remove Mega Man" }));
    expect(create).toBeDisabled();
  });

  it("queues a new game via the stacked dialog without any network call", () => {
    renderModal();
    typeTitle(boxDialog(), "Mega Man Collection");
    pickSystem(boxDialog(), "SNES");

    fireEvent.click(screen.getByRole("button", { name: "Add New Game" }));
    const dialog = gameDialog();
    // The stacked dialog's System follows the box's current pick.
    expect(
      within(dialog).getByRole("button", { name: "System" }),
    ).toHaveTextContent("SNES");

    typeTitle(dialog, "Mega Man X");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    const list = screen.getByRole("list", { name: "Games in this box" });
    const row = within(list).getAllByRole("listitem")[0];
    expect(row).toHaveTextContent("Mega Man X");
    expect(row).toHaveTextContent("New");
    // Appending is local — nothing was persisted.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("attaches existing games through the picker, hiding already-added ones and labeling shelved ones", async () => {
    renderModal();

    const picker = screen.getByRole("searchbox", {
      name: "Add an existing game",
    });
    fireEvent.focus(picker);
    // The list loads once, lazily, from the games search.
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch.mock.calls[0][0]).toBe("/api/video-games/search");

    fireEvent.change(picker, { target: { value: "mega man" } });
    const results = await screen.findByRole("list", { name: "Matching games" });
    // Title-contains filtering: Castlevania is out, the two Mega Mans are in,
    // and the one already shelved elsewhere says so.
    expect(within(results).queryByText("Castlevania")).not.toBeInTheDocument();
    expect(
      within(results).getByText("in Mega Man Legacy Collection"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(results).getByRole("button", { name: /^Mega Man 2/ }),
    );

    const list = screen.getByRole("list", { name: "Games in this box" });
    const row = within(list).getAllByRole("listitem")[0];
    expect(row).toHaveTextContent("Mega Man 2");
    expect(row).toHaveTextContent("Existing");

    // The picked game no longer appears in a fresh search.
    fireEvent.change(picker, { target: { value: "mega man" } });
    const again = await screen.findByRole("list", { name: "Matching games" });
    expect(
      within(again).queryByRole("button", { name: /^Mega Man 2/ }),
    ).not.toBeInTheDocument();
  });

  it("submits the full box payload: ids for existing games, inputs for new ones", async () => {
    const { onCreate, onClose } = renderModal();
    typeTitle(boxDialog(), "  Mega Man Collection  ");
    pickSystem(boxDialog(), "NES");
    fireEvent.click(
      within(boxDialog()).getByRole("button", { name: "Physical: No" }),
    );

    addNewGame("Mega Man X");
    await addExistingGame("castle", /^Castlevania/);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      title: "Mega Man Collection",
      systemId: 1,
      existingVideoGameIds: [43],
      newVideoGames: [
        { title: "Mega Man X", systemId: 1, customFieldValues: [] },
      ],
      isPhysical: true,
      customFieldValues: [],
    });
  });

  it("Escape closes only the stacked dialog first, then the box dialog", () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Add New Game" }));
    expect(gameDialog()).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Create Video Game" }),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe("mass-input mode", () => {
    it("labels the button Create And Add Another and resets the games list after a create", async () => {
      const { onCreate, onClose } = renderModal({ massInputMode: true });
      typeTitle(boxDialog(), "Mega Man Collection");
      pickSystem(boxDialog(), "NES");

      // The stacked dialog inherits the mass-input loop: it stays open after
      // each queued game (handy for filling a collection) and exits via X.
      fireEvent.click(screen.getByRole("button", { name: "Add New Game" }));
      const dialog = gameDialog();
      typeTitle(dialog, "Mega Man X");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Create And Add Another" }),
      );
      expect(gameDialog()).toBeVisible();
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

      fireEvent.click(
        screen.getByRole("button", { name: "Create And Add Another" }),
      );

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
      // Still open, with the whole form — games included — cleared.
      expect(onClose).not.toHaveBeenCalled();
      expect(boxDialog()).toBeVisible();
      await waitFor(() =>
        expect(screen.getByText("Add at least one game.")).toBeInTheDocument(),
      );
      expect(
        screen.queryByText("Mega Man Collection"),
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
