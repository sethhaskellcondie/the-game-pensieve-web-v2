// Shape, defaults, and (de)serialization for the app's UI settings.
//
// These are persisted in the backend "metadata" store under the key
// `ui-settings`, where the record's `value` field holds a JSON-encoded STRING
// using snake_case keys (e.g. "{\"mass_input_mode\":false,...}"). The rest of
// the app works in camelCase, so the mapping lives here at the boundary.
//
// This module is intentionally free of any server-only code (no API_BASE_URL,
// no fetch) so it is safe to import from Client Components.

// The two views the video games page offers. Lives here (not in the view
// components) because the user's preferred default is a persisted UI setting.
export type VideoGamesView = "list" | "shelf";

export type UiSettings = {
  massInputMode: boolean;
  massEditMode: boolean;
  developerMode: boolean;
  hideAnimations: boolean;
  videoGamesDefaultView: VideoGamesView;
};

export const DEFAULT_UI_SETTINGS: UiSettings = {
  massInputMode: false,
  massEditMode: false,
  developerMode: false,
  hideAnimations: false,
  videoGamesDefaultView: "list",
};

// Narrows an untrusted value to a VideoGamesView, falling back to "list".
export function asVideoGamesView(value: unknown): VideoGamesView {
  return value === "shelf" ? "shelf" : "list";
}

export const UI_SETTINGS_KEY = "ui-settings";

// Snake_case shape as stored in the metadata `value` string.
type StoredUiSettings = {
  mass_input_mode: boolean;
  mass_edit_mode: boolean;
  developer_mode: boolean;
  hide_animations: boolean;
  video_games_default_view: VideoGamesView;
};

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
      videoGamesDefaultView: asVideoGamesView(parsed?.video_games_default_view),
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
    video_games_default_view: settings.videoGamesDefaultView,
  };
  return JSON.stringify(stored);
}
