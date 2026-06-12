import { loadUiSettings } from "@/lib/uiSettings";
import {
  DEFAULT_STANDARD_FIELDS,
  DEFAULT_UI_SETTINGS,
  parseUiSettingsValue,
  serializeUiSettings,
  type UiSettings,
} from "@/lib/uiSettings.types";

// Builds a metadata-record envelope ({ data, errors }) as the backend returns it.
function metadataResponse(value: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        id: 1,
        key: "ui-settings",
        value,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
        deletedAt: null,
      },
      errors: null,
    }),
  } as Response;
}

describe("serializeUiSettings / parseUiSettingsValue", () => {
  it("round-trips through the snake_case JSON string", () => {
    const settings: UiSettings = {
      massInputMode: true,
      massEditMode: false,
      developerMode: true,
      hideAnimations: true,
      beginnerMode: true,
      videoGamesDefaultView: "shelf",
      boardGamesDefaultView: "list",
      standardFields: {
        toy: { set: false },
        system: { generation: true, handheld: false },
        boardGame: { boxes: true },
        boardGameBox: {
          boardGame: true,
          expansion: false,
          standAlone: true,
          baseSet: false,
        },
        videoGame: { system: true, boxes: false },
        videoGameBox: {
          system: false,
          games: true,
          physical: true,
          collection: false,
        },
      },
    };
    const value = serializeUiSettings(settings);
    expect(JSON.parse(value)).toEqual({
      mass_input_mode: true,
      mass_edit_mode: false,
      developer_mode: true,
      hide_animations: true,
      beginner_mode: true,
      video_games_default_view: "shelf",
      board_games_default_view: "list",
      standard_fields: {
        toy: { set: false },
        system: { generation: true, handheld: false },
        board_game: { boxes: true },
        board_game_box: {
          board_game: true,
          expansion: false,
          stand_alone: true,
          base_set: false,
        },
        video_game: { system: true, boxes: false },
        video_game_box: {
          system: false,
          games: true,
          physical: true,
          collection: false,
        },
      },
    });
    expect(parseUiSettingsValue(value)).toEqual(settings);
  });

  it("falls back to defaults for malformed JSON", () => {
    expect(parseUiSettingsValue("not json {")).toEqual(DEFAULT_UI_SETTINGS);
  });

  it("fills missing keys with defaults", () => {
    expect(parseUiSettingsValue(JSON.stringify({ developer_mode: true }))).toEqual(
      {
        massInputMode: false,
        massEditMode: false,
        developerMode: true,
        hideAnimations: false,
        beginnerMode: false,
        videoGamesDefaultView: "list",
        boardGamesDefaultView: "list",
        standardFields: DEFAULT_STANDARD_FIELDS,
      },
    );
  });

  it("parses a partial standard_fields, defaulting missing fields to shown", () => {
    const parsed = parseUiSettingsValue(
      JSON.stringify({
        standard_fields: {
          board_game_box: { stand_alone: false },
          video_game_box: { collection: false },
        },
      }),
    );
    expect(parsed.standardFields).toEqual({
      ...DEFAULT_STANDARD_FIELDS,
      boardGameBox: {
        boardGame: true,
        expansion: true,
        standAlone: false,
        baseSet: true,
      },
      videoGameBox: {
        system: true,
        games: true,
        physical: true,
        collection: false,
      },
    });
  });

  it("falls back to the list view for an unrecognized stored view", () => {
    const parsed = parseUiSettingsValue(
      JSON.stringify({
        video_games_default_view: "carousel",
        board_games_default_view: "carousel",
      }),
    );
    expect(parsed.videoGamesDefaultView).toBe("list");
    expect(parsed.boardGamesDefaultView).toBe("list");
  });
});

describe("loadUiSettings", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    // The server-side API client needs a base URL; outside development it reads
    // API_BASE_URL, which isn't set in the test environment.
    process.env.API_BASE_URL = "http://backend.test/v1";
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.API_BASE_URL;
    mockFetch.mockReset();
  });

  it("parses an existing entry without creating one", async () => {
    mockFetch.mockResolvedValueOnce(
      metadataResponse(
        JSON.stringify({
          mass_input_mode: true,
          mass_edit_mode: false,
          developer_mode: true,
          hide_animations: true,
          beginner_mode: true,
          video_games_default_view: "shelf",
          board_games_default_view: "shelf",
        }),
      ),
    );

    const settings = await loadUiSettings();

    expect(settings).toEqual({
      massInputMode: true,
      massEditMode: false,
      developerMode: true,
      hideAnimations: true,
      beginnerMode: true,
      videoGamesDefaultView: "shelf",
      boardGamesDefaultView: "shelf",
      standardFields: DEFAULT_STANDARD_FIELDS,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/metadata/ui-settings"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("creates the entry with all-false defaults on a 404", async () => {
    // GET returns 404, then POST creates the entry.
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)
      .mockResolvedValueOnce(
        metadataResponse(serializeUiSettings(DEFAULT_UI_SETTINGS)),
      );

    const settings = await loadUiSettings();

    expect(settings).toEqual(DEFAULT_UI_SETTINGS);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const [postUrl, postInit] = mockFetch.mock.calls[1];
    expect(postUrl).toContain("/metadata");
    expect(postInit.method).toBe("POST");
    const body = JSON.parse(postInit.body as string);
    expect(body.metadata.key).toBe("ui-settings");
    expect(JSON.parse(body.metadata.value)).toEqual({
      mass_input_mode: false,
      mass_edit_mode: false,
      developer_mode: false,
      hide_animations: false,
      beginner_mode: false,
      video_games_default_view: "list",
      board_games_default_view: "list",
      standard_fields: {
        toy: { set: true },
        system: { generation: true, handheld: true },
        board_game: { boxes: true },
        board_game_box: {
          board_game: true,
          expansion: true,
          stand_alone: true,
          base_set: true,
        },
        video_game: { system: true, boxes: true },
        video_game_box: {
          system: true,
          games: true,
          physical: true,
          collection: true,
        },
      },
    });
  });

  it("falls back to defaults when the stored value is malformed", async () => {
    mockFetch.mockResolvedValueOnce(metadataResponse("not json {"));

    expect(await loadUiSettings()).toEqual(DEFAULT_UI_SETTINGS);
  });

  it("falls back to defaults when the network request throws", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));

    expect(await loadUiSettings()).toEqual(DEFAULT_UI_SETTINGS);
  });

  it("falls back to defaults when the envelope reports errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: null, errors: ["boom"] }),
    } as Response);

    expect(await loadUiSettings()).toEqual(DEFAULT_UI_SETTINGS);
  });
});
