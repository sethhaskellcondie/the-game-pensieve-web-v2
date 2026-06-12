import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CustomField, System, VideoGame } from "@/lib/api";
import VideoGameDetail from "@/components/video-games/VideoGameDetail";
import { ToastProvider } from "@/components/ToastProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

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

const definitions: CustomField[] = [
  { id: 1, name: "Developer", type: "text", entityKey: "videoGame", order: 0, options: [] },
  {
    id: 2,
    name: "Genre",
    type: "dropdown",
    entityKey: "videoGame",
    order: 1,
    options: [
      { id: 11, customFieldId: 2, name: "Action", isDefault: true, order: 0 },
      { id: 12, customFieldId: 2, name: "RPG", isDefault: false, order: 1 },
    ],
  },
  { id: 3, name: "Favorite", type: "boolean", entityKey: "videoGame", order: 2, options: [] },
];

const game: VideoGame = {
  id: 7,
  key: "videoGame",
  title: "Secret of Mana",
  system: systems[1],
  videoGameBoxes: [
    { id: 41, title: "Secret of Mana (Box)" },
    { id: 42, title: "SNES Classics Collection" },
  ],
  customFieldValues: [
    { customFieldId: 1, customFieldName: "Developer", customFieldType: "text", value: "Square", valueOptionId: null },
    { customFieldId: 2, customFieldName: "Genre", customFieldType: "dropdown", value: "RPG", valueOptionId: 12 },
    { customFieldId: 3, customFieldName: "Favorite", customFieldType: "boolean", value: "false", valueOptionId: null },
  ],
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
};

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ status: "ok", data: game }),
    text: async () => "{}",
  } as unknown as Response;
}

const mockFetch = jest.fn();

function renderDetail(override?: VideoGame) {
  return render(
    <ToastProvider>
      <UiSettingsProvider initial={DEFAULT_UI_SETTINGS}>
        <VideoGameDetail
          game={override ?? game}
          definitions={definitions}
          systems={systems}
        />
      </UiSettingsProvider>
    </ToastProvider>,
  );
}

// The body of the most recent PUT to the game, parsed.
function lastPutBody() {
  const put = [...mockFetch.mock.calls]
    .reverse()
    .find(([, init]) => init?.method === "PUT");
  return put ? JSON.parse(put[1].body) : null;
}

describe("VideoGameDetail", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(okResponse());
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("renders the game in the header, a back link, a row per field, and the boxes card", () => {
    renderDetail();

    expect(
      screen.getByRole("heading", { level: 1, name: "VIDEO GAME" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Secret of Mana · SNES")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/video-games?view=list",
    );

    // Fixed Title + System rows, plus the three custom-field rows.
    expect(screen.getByRole("button", { name: "Edit Title" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "System" })).toHaveTextContent(
      "SNES",
    );
    expect(
      screen.getByText((_, el) => el?.textContent === "3 custom fields"),
    ).toBeInTheDocument();

    // The two built-in rows are tagged as "Standard" fields.
    expect(screen.getAllByText("Standard")).toHaveLength(2);

    // A sample of each value rendering.
    expect(
      screen.getByRole("button", { name: "Edit Developer" }),
    ).toHaveTextContent("Square");
    expect(
      screen.getByRole("button", { name: "Favorite: No" }),
    ).toBeInTheDocument();

    // The boxes card lists each box title with a count.
    expect(
      screen.getByText((_, el) => el?.textContent === "2 boxes"),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Video game boxes" });
    expect(within(list).getByText("Secret of Mana (Box)")).toBeInTheDocument();
    expect(
      within(list).getByText("SNES Classics Collection"),
    ).toBeInTheDocument();
  });

  it("shows an empty message when the game has no boxes", () => {
    renderDetail({ ...game, videoGameBoxes: [] });

    expect(screen.getByText("No boxes yet.")).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Video game boxes" }),
    ).not.toBeInTheDocument();
  });

  it("inline-edits the Title and PUTs the full game", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Title" }));
    const input = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "Trials of Mana" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(lastPutBody()).toMatchObject({
      title: "Trials of Mana",
      systemId: 2,
      customFieldValues: game.customFieldValues,
    });
    // Optimistic: the header tagline reflects the new title.
    expect(screen.getByText("Trials of Mana · SNES")).toBeInTheDocument();
  });

  it("treats a blank Title as a no-op (no PUT, value unchanged)", () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Title" }));
    const input = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit Title" })).toHaveTextContent(
      "Secret of Mana",
    );
  });

  it("changes the System via the dropdown and PUTs the new systemId", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "System" }));
    fireEvent.click(screen.getByRole("option", { name: "NES" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(lastPutBody()).toMatchObject({
      title: "Secret of Mana",
      systemId: 1,
      customFieldValues: game.customFieldValues,
    });
    // Optimistic: the header tagline reflects the new system.
    expect(screen.getByText("Secret of Mana · NES")).toBeInTheDocument();
  });

  it("treats re-picking the current system as a no-op", () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "System" }));
    fireEvent.click(screen.getByRole("option", { name: "SNES" }));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("edits a text custom field, merging the value into customFieldValues", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Developer" }));
    const input = screen.getByRole("textbox", { name: "Developer" });
    fireEvent.change(input, { target: { value: "Squaresoft" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const cf = lastPutBody().customFieldValues.find(
      (v: { customFieldId: number }) => v.customFieldId === 1,
    );
    expect(cf.value).toBe("Squaresoft");
    expect(cf.valueOptionId).toBeNull();
  });

  it("changes a dropdown custom field via the custom listbox", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Genre" }));
    fireEvent.click(screen.getByRole("option", { name: "Action" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const cf = lastPutBody().customFieldValues.find(
      (v: { customFieldId: number }) => v.customFieldId === 2,
    );
    expect(cf.value).toBe("Action");
    expect(cf.valueOptionId).toBe(11);
  });

  it("rolls back the optimistic value when the PUT fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: "boom" }),
      text: async () => "{}",
    } as unknown as Response);
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "System" }));
    fireEvent.click(screen.getByRole("option", { name: "NES" }));

    // After the failed request, the original system is restored.
    await waitFor(() =>
      expect(screen.getByText("Secret of Mana · SNES")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "System" })).toHaveTextContent(
      "SNES",
    );
  });
});
