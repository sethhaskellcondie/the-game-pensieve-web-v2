// Shape, defaults, and (de)serialization for the per-entity default sort
// options.
//
// These are persisted in the backend "metadata" store under the key
// `default_sort_options`, where the record's `value` field holds a
// JSON-encoded STRING keyed by snake_case entity names, e.g.
// "{\"system\":[{\"field\":\"name\",\"direction\":\"asc\"}],...}". The rest of
// the app works with the camelCase EntityKey union, so the mapping lives here
// at the boundary.
//
// This module is intentionally free of any server-only code (no API_BASE_URL,
// no fetch) so it is safe to import from Client Components.

import type { EntityKey } from "./api";

// One stored sort level: the backend field token plus a direction. Mirrors
// ActiveSort minus the UI-local id and label — those are resolved against the
// entity's live field list whenever the level is applied, so a stored level
// survives a custom field being renamed out from under it (it's just dropped).
export type DefaultSortLevel = {
  field: string;
  direction: "asc" | "desc";
};

// The default sort levels for every entity, in priority order (first =
// primary sort, second = tiebreaker, …). An empty array means the entity has
// no default and keeps the backend's natural order.
export type DefaultSortOptions = Record<EntityKey, DefaultSortLevel[]>;

export const DEFAULT_SORT_OPTIONS_KEY = "default_sort_options";

export const EMPTY_DEFAULT_SORT_OPTIONS: DefaultSortOptions = {
  toy: [],
  system: [],
  videoGame: [],
  videoGameBox: [],
  boardGame: [],
  boardGameBox: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Narrows an untrusted value to a list of sort levels: entries without a
// usable field name are dropped, and anything but an explicit "desc" sorts
// ascending.
function asDefaultSortLevels(value: unknown): DefaultSortLevel[] {
  if (!Array.isArray(value)) return [];
  const out: DefaultSortLevel[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const field = entry.field;
    if (typeof field !== "string" || field.trim() === "") continue;
    out.push({ field, direction: entry.direction === "desc" ? "desc" : "asc" });
  }
  return out;
}

// Narrows an untrusted camelCase-keyed value (e.g. a route handler's request
// body) to a DefaultSortOptions. Missing or malformed entities fall back to
// no default sort.
export function asDefaultSortOptions(value: unknown): DefaultSortOptions {
  const v = isRecord(value) ? value : {};
  return {
    toy: asDefaultSortLevels(v.toy),
    system: asDefaultSortLevels(v.system),
    videoGame: asDefaultSortLevels(v.videoGame),
    videoGameBox: asDefaultSortLevels(v.videoGameBox),
    boardGame: asDefaultSortLevels(v.boardGame),
    boardGameBox: asDefaultSortLevels(v.boardGameBox),
  };
}

// Parses the metadata `value` JSON string into DefaultSortOptions. Defensive
// by design: malformed JSON or missing keys fall back to no defaults rather
// than throwing, so a corrupt stored value can never crash a render.
export function parseDefaultSortOptionsValue(value: string): DefaultSortOptions {
  try {
    const parsed: unknown = JSON.parse(value);
    const v = isRecord(parsed) ? parsed : {};
    return asDefaultSortOptions({
      toy: v.toy,
      system: v.system,
      videoGame: v.video_game,
      videoGameBox: v.video_game_box,
      boardGame: v.board_game,
      boardGameBox: v.board_game_box,
    });
  } catch {
    return { ...EMPTY_DEFAULT_SORT_OPTIONS };
  }
}

// Serializes DefaultSortOptions into the snake_case JSON string the backend
// stores. The levels themselves are stored as-is ({ field, direction }).
export function serializeDefaultSortOptions(
  options: DefaultSortOptions,
): string {
  return JSON.stringify({
    toy: options.toy,
    system: options.system,
    video_game: options.videoGame,
    video_game_box: options.videoGameBox,
    board_game: options.boardGame,
    board_game_box: options.boardGameBox,
  });
}
