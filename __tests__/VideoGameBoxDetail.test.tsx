import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CustomField, System, VideoGameBox } from "@/lib/api";
import VideoGameBoxDetail from "@/components/video-games/VideoGameBoxDetail";
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
  { id: 1, name: "Condition", type: "text", entityKey: "videoGameBox", order: 0, options: [] },
  { id: 2, name: "Sealed", type: "boolean", entityKey: "videoGameBox", order: 1, options: [] },
];

// The videoGame entity's definitions drive the read-only game chart.
const gameDefinitions: CustomField[] = [
  { id: 11, name: "Finished", type: "boolean", entityKey: "videoGame", order: 0, options: [] },
  { id: 12, name: "Hours Played", type: "number", entityKey: "videoGame", order: 1, options: [] },
];

const box: VideoGameBox = {
  id: 9,
  key: "videoGameBox",
  title: "Super Mario All-Stars",
  system: systems[1],
  videoGames: [
    {
      id: 71,
      title: "Super Mario Bros.",
      customFieldValues: [
        { customFieldId: 11, customFieldName: "Finished", customFieldType: "boolean", value: "true" },
        { customFieldId: 12, customFieldName: "Hours Played", customFieldType: "number", value: "14" },
      ],
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    },
    { id: 72, title: "Super Mario Bros. 3", customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
  ],
  isPhysical: true,
  isCollection: true,
  customFieldValues: [
    { customFieldId: 1, customFieldName: "Condition", customFieldType: "text", value: "Mint" },
    { customFieldId: 2, customFieldName: "Sealed", customFieldType: "boolean", value: "false" },
  ],
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
};

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ status: "ok", data: box }),
    text: async () => "{}",
  } as unknown as Response;
}

const mockFetch = jest.fn();

function renderDetail(override?: VideoGameBox) {
  return render(
    <ToastProvider>
      <UiSettingsProvider initial={DEFAULT_UI_SETTINGS}>
        <VideoGameBoxDetail
          box={override ?? box}
          definitions={definitions}
          gameDefinitions={gameDefinitions}
          systems={systems}
        />
      </UiSettingsProvider>
    </ToastProvider>,
  );
}

// The body of the most recent PUT to the box, parsed.
function lastPutBody() {
  const put = [...mockFetch.mock.calls]
    .reverse()
    .find(([, init]) => init?.method === "PUT");
  return put ? JSON.parse(put[1].body) : null;
}

describe("VideoGameBoxDetail", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(okResponse());
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("renders the box in the header, a back link to the shelf, a row per field, and the games card", () => {
    renderDetail();

    expect(
      screen.getByRole("heading", { level: 1, name: "VIDEO GAME BOX" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Super Mario All-Stars · SNES"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/video-games?view=shelf",
    );

    // Fixed Title + System + Physical rows, plus the two custom-field rows.
    expect(screen.getByRole("button", { name: "Edit Title" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "System" })).toHaveTextContent(
      "SNES",
    );
    expect(
      screen.getByRole("button", { name: "Physical: Yes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.textContent === "2 custom fields"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Condition" }),
    ).toHaveTextContent("Mint");
    expect(
      screen.getByRole("button", { name: "Sealed: No" }),
    ).toBeInTheDocument();

    // The games card links each game to its detail page.
    expect(
      screen.getByText((_, el) => el?.textContent === "2 games"),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Video games" });
    expect(
      within(list).getByRole("link", { name: "Super Mario Bros." }),
    ).toHaveAttribute("href", "/video-games/71");
    expect(
      within(list).getByRole("link", { name: "Super Mario Bros. 3" }),
    ).toHaveAttribute("href", "/video-games/72");
  });

  it("does not render the derived Collection value at all", () => {
    renderDetail();

    // Collection is backend-derived and uneditable, so the Fields card omits
    // it entirely — no label, no editor.
    expect(screen.queryByText("Collection")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Collection/ }),
    ).not.toBeInTheDocument();
  });

  it("renders each game's custom-field values read-only in the games chart", () => {
    renderDetail();

    const list = screen.getByRole("list", { name: "Video games" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    // Each row shows the box's system chip and one cell per videoGame field.
    const [mario, mario3] = items;
    expect(within(mario).getByText("SNES")).toBeInTheDocument();
    expect(within(mario).getByText("Finished")).toBeInTheDocument();
    expect(within(mario).getByRole("img", { name: "Yes" })).toBeInTheDocument();
    expect(within(mario).getByText("Hours Played")).toBeInTheDocument();
    expect(within(mario).getByText("14")).toBeInTheDocument();

    // A game without a stored value falls back to the muted dash.
    expect(within(mario3).getAllByText("—")).toHaveLength(2);

    // Read-only: the only buttons are the per-game remove-from-box controls.
    const buttons = within(list).getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Delete Super Mario Bros.",
      "Delete Super Mario Bros. 3",
    ]);
  });

  it("offers no delete button when the box holds a single game", () => {
    renderDetail({ ...box, videoGames: [box.videoGames[0]] });

    // The last game can't be removed from a box.
    expect(
      screen.queryByRole("button", { name: /^Delete / }),
    ).not.toBeInTheDocument();
  });

  it("deletes a game after confirming, PUTting the box without its id", async () => {
    renderDetail();

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Super Mario Bros." }),
    );

    // The confirmation menu asks before anything is sent.
    const menu = screen.getByRole("menu", { name: "Delete Super Mario Bros.?" });
    expect(within(menu).getByText("Are you sure?")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(lastPutBody()).toMatchObject({ existingVideoGameIds: [72] });
    // Optimistic: the row is gone and the menu closed.
    expect(
      screen.queryByRole("link", { name: "Super Mario Bros." }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("dismisses the confirmation menu on an outside click without deleting", () => {
    renderDetail();

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Super Mario Bros." }),
    );
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Super Mario Bros." }),
    ).toBeInTheDocument();
  });

  it("shows an empty message when the box has no games", () => {
    renderDetail({ ...box, videoGames: [] });

    expect(screen.getByText("No games yet.")).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Video games" }),
    ).not.toBeInTheDocument();
  });

  it("inline-edits the Title and PUTs the full box, including its game ids", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Title" }));
    const input = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "Mario All-Stars + World" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(lastPutBody()).toEqual({
      title: "Mario All-Stars + World",
      systemId: 2,
      existingVideoGameIds: [71, 72],
      newVideoGames: [],
      isPhysical: true,
      customFieldValues: box.customFieldValues,
    });
    // Optimistic: the header tagline reflects the new title.
    expect(
      screen.getByText("Mario All-Stars + World · SNES"),
    ).toBeInTheDocument();
  });

  it("treats a blank Title as a no-op (no PUT, value unchanged)", () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Title" }));
    const input = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit Title" })).toHaveTextContent(
      "Super Mario All-Stars",
    );
  });

  it("changes the System via the dropdown and PUTs the new systemId", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "System" }));
    fireEvent.click(screen.getByRole("option", { name: "NES" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(lastPutBody()).toMatchObject({
      title: "Super Mario All-Stars",
      systemId: 1,
      existingVideoGameIds: [71, 72],
    });
    expect(
      screen.getByText("Super Mario All-Stars · NES"),
    ).toBeInTheDocument();
  });

  it("toggles Physical and PUTs the flipped value", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Physical: Yes" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(lastPutBody()).toMatchObject({ isPhysical: false });
    expect(
      screen.getByRole("button", { name: "Physical: No" }),
    ).toBeInTheDocument();
  });

  it("edits a text custom field, merging the value into customFieldValues", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Condition" }));
    const input = screen.getByRole("textbox", { name: "Condition" });
    fireEvent.change(input, { target: { value: "Good" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const cf = lastPutBody().customFieldValues.find(
      (v: { customFieldId: number }) => v.customFieldId === 1,
    );
    expect(cf.value).toBe("Good");
  });

  it("rolls back the optimistic value when the PUT fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: "boom" }),
      text: async () => "{}",
    } as unknown as Response);
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Physical: Yes" }));

    // After the failed request, the original value is restored.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Physical: Yes" }),
      ).toBeInTheDocument(),
    );
  });
});
