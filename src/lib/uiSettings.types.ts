// Shape, defaults, and (de)serialization for the app's UI settings.
//
// These are persisted in the backend "metadata" store under the key
// `ui-settings`, where the record's `value` field holds a JSON-encoded STRING
// using snake_case keys (e.g. "{\"mass_input_mode\":false,...}"). The rest of
// the app works in camelCase, so the mapping lives here at the boundary.
//
// This module is intentionally free of any server-only code (no API_BASE_URL,
// no fetch) so it is safe to import from Client Components.

// The two views a game collection page offers (video games today, board games
// to come). Lives here (not in the view components) because the user's
// preferred default per collection is a persisted UI setting.
export type CollectionView = "list" | "shelf";

// Per-entity visibility of the optional standard columns in each display grid.
// The title/name column is always shown, so it has no entry here. Keys mirror
// the EntityKey union in src/lib/api.ts; true means the column is shown.
export type StandardFieldVisibility = {
  toy: { set: boolean };
  system: { generation: boolean; handheld: boolean };
  boardGame: { boxes: boolean };
  boardGameBox: {
    boardGame: boolean;
    expansion: boolean;
    standAlone: boolean;
    baseSet: boolean;
  };
  videoGame: { system: boolean; boxes: boolean };
  videoGameBox: {
    system: boolean;
    games: boolean;
    physical: boolean;
    collection: boolean;
  };
};

export const DEFAULT_STANDARD_FIELDS: StandardFieldVisibility = {
  toy: { set: true },
  system: { generation: true, handheld: true },
  boardGame: { boxes: true },
  boardGameBox: {
    boardGame: true,
    expansion: true,
    standAlone: true,
    baseSet: true,
  },
  videoGame: { system: true, boxes: true },
  videoGameBox: { system: true, games: true, physical: true, collection: true },
};

export type UiSettings = {
  massInputMode: boolean;
  massEditMode: boolean;
  developerMode: boolean;
  hideAnimations: boolean;
  beginnerMode: boolean;
  videoGamesDefaultView: CollectionView;
  boardGamesDefaultView: CollectionView;
  standardFields: StandardFieldVisibility;
};

export const DEFAULT_UI_SETTINGS: UiSettings = {
  massInputMode: false,
  massEditMode: false,
  developerMode: false,
  hideAnimations: false,
  beginnerMode: false,
  videoGamesDefaultView: "list",
  boardGamesDefaultView: "list",
  standardFields: DEFAULT_STANDARD_FIELDS,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Narrows an untrusted value to a StandardFieldVisibility. Missing or
// non-boolean entries fall back to true, so a field stays visible until the
// user hides it explicitly (and newly added fields default to shown).
export function asStandardFieldVisibility(
  value: unknown,
): StandardFieldVisibility {
  const groups = isRecord(value) ? value : {};
  const group = (name: string): Record<string, unknown> => {
    const g = groups[name];
    return isRecord(g) ? g : {};
  };
  const shown = (g: Record<string, unknown>, key: string): boolean =>
    g[key] !== false;
  const toy = group("toy");
  const system = group("system");
  const boardGame = group("boardGame");
  const boardGameBox = group("boardGameBox");
  const videoGame = group("videoGame");
  const videoGameBox = group("videoGameBox");
  return {
    toy: { set: shown(toy, "set") },
    system: {
      generation: shown(system, "generation"),
      handheld: shown(system, "handheld"),
    },
    boardGame: { boxes: shown(boardGame, "boxes") },
    boardGameBox: {
      boardGame: shown(boardGameBox, "boardGame"),
      expansion: shown(boardGameBox, "expansion"),
      standAlone: shown(boardGameBox, "standAlone"),
      baseSet: shown(boardGameBox, "baseSet"),
    },
    videoGame: {
      system: shown(videoGame, "system"),
      boxes: shown(videoGame, "boxes"),
    },
    videoGameBox: {
      system: shown(videoGameBox, "system"),
      games: shown(videoGameBox, "games"),
      physical: shown(videoGameBox, "physical"),
      collection: shown(videoGameBox, "collection"),
    },
  };
}

// Narrows an untrusted value to a CollectionView, falling back to "list".
export function asCollectionView(value: unknown): CollectionView {
  return value === "shelf" ? "shelf" : "list";
}

export const UI_SETTINGS_KEY = "ui-settings";

// Snake_case shape as stored in the metadata `value` string.
type StoredStandardFields = {
  toy: { set: boolean };
  system: { generation: boolean; handheld: boolean };
  board_game: { boxes: boolean };
  board_game_box: {
    board_game: boolean;
    expansion: boolean;
    stand_alone: boolean;
    base_set: boolean;
  };
  video_game: { system: boolean; boxes: boolean };
  video_game_box: {
    system: boolean;
    games: boolean;
    physical: boolean;
    collection: boolean;
  };
};

type StoredUiSettings = {
  mass_input_mode: boolean;
  mass_edit_mode: boolean;
  developer_mode: boolean;
  hide_animations: boolean;
  beginner_mode: boolean;
  video_games_default_view: CollectionView;
  board_games_default_view: CollectionView;
  standard_fields: StoredStandardFields;
};

// Maps the stored snake_case standard-fields groups back to camelCase, then
// normalizes through asStandardFieldVisibility so partial or malformed groups
// fall back to shown. Only boardGameBox has field names that differ between
// the two casings; the other groups' keys are single words.
function parseStoredStandardFields(value: unknown): StandardFieldVisibility {
  const groups = isRecord(value) ? value : {};
  const group = (name: string): Record<string, unknown> => {
    const g = groups[name];
    return isRecord(g) ? g : {};
  };
  const boardGameBox = group("board_game_box");
  return asStandardFieldVisibility({
    toy: group("toy"),
    system: group("system"),
    boardGame: group("board_game"),
    boardGameBox: {
      boardGame: boardGameBox.board_game,
      expansion: boardGameBox.expansion,
      standAlone: boardGameBox.stand_alone,
      baseSet: boardGameBox.base_set,
    },
    videoGame: group("video_game"),
    videoGameBox: group("video_game_box"),
  });
}

function serializeStandardFields(
  fields: StandardFieldVisibility,
): StoredStandardFields {
  return {
    toy: { ...fields.toy },
    system: { ...fields.system },
    board_game: { ...fields.boardGame },
    board_game_box: {
      board_game: fields.boardGameBox.boardGame,
      expansion: fields.boardGameBox.expansion,
      stand_alone: fields.boardGameBox.standAlone,
      base_set: fields.boardGameBox.baseSet,
    },
    video_game: { ...fields.videoGame },
    video_game_box: { ...fields.videoGameBox },
  };
}

// Parses the metadata `value` JSON string into UiSettings. Defensive by design:
// malformed JSON or missing keys fall back to the defaults rather than throwing,
// so a corrupt stored value can never crash a render.
export function parseUiSettingsValue(value: string): UiSettings {
  try {
    const parsed = JSON.parse(value) as Partial<StoredUiSettings>;
    return {
      massInputMode: Boolean(parsed?.mass_input_mode),
      massEditMode: Boolean(parsed?.mass_edit_mode),
      developerMode: Boolean(parsed?.developer_mode),
      hideAnimations: Boolean(parsed?.hide_animations),
      beginnerMode: Boolean(parsed?.beginner_mode),
      videoGamesDefaultView: asCollectionView(parsed?.video_games_default_view),
      boardGamesDefaultView: asCollectionView(parsed?.board_games_default_view),
      standardFields: parseStoredStandardFields(parsed?.standard_fields),
    };
  } catch {
    return { ...DEFAULT_UI_SETTINGS };
  }
}

// Serializes UiSettings into the snake_case JSON string the backend stores.
export function serializeUiSettings(settings: UiSettings): string {
  const stored: StoredUiSettings = {
    mass_input_mode: settings.massInputMode,
    mass_edit_mode: settings.massEditMode,
    developer_mode: settings.developerMode,
    hide_animations: settings.hideAnimations,
    beginner_mode: settings.beginnerMode,
    video_games_default_view: settings.videoGamesDefaultView,
    board_games_default_view: settings.boardGamesDefaultView,
    standard_fields: serializeStandardFields(settings.standardFields),
  };
  return JSON.stringify(stored);
}
