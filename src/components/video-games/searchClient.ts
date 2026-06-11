// Client-side fetch helpers for the video games pages. They call the Next
// route handlers (the lib/api functions run server-side only) and are shared
// by the list view (VideoGamesManager) and the shelf view (VideoGameShelf).

import type {
  CustomField,
  EntityKey,
  FilterRequestDto,
  FilterSpecification,
  System,
  VideoGame,
  VideoGameBox,
} from "@/lib/api";

// Reads a route handler's response once, throwing the forwarded backend message
// on failure. Route handlers answer { status, data } or { status, message }.
export async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as
    | { data?: T; message?: string }
    | null;
  if (!res.ok) {
    throw new Error(body?.message ?? "Request failed");
  }
  return body?.data as T;
}

// Run the backend search through the route handler. An empty filter set
// returns every video game.
export async function searchVideoGamesClient(
  filters: FilterRequestDto[],
  signal?: AbortSignal,
): Promise<VideoGame[]> {
  const res = await fetch("/api/video-games/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters }),
    signal,
  });
  return readJson<VideoGame[]>(res);
}

// Same as above for video game boxes — the shelf view's entity.
export async function searchVideoGameBoxesClient(
  filters: FilterRequestDto[],
  signal?: AbortSignal,
): Promise<VideoGameBox[]> {
  const res = await fetch("/api/video-game-boxes/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters }),
    signal,
  });
  return readJson<VideoGameBox[]>(res);
}

// All systems, for System dropdowns and the system_id filter's name list.
// Loaded once on mount alongside the entity search.
export async function searchSystemsClient(
  signal?: AbortSignal,
): Promise<System[]> {
  const res = await fetch("/api/systems/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters: [] }),
    signal,
  });
  return readJson<System[]>(res);
}

// An entity's custom-field definitions, reusing the existing custom-fields
// route. They give the authoritative ordered set of dynamic columns/fields.
export async function fetchEntityFields(
  entity: EntityKey,
  signal?: AbortSignal,
): Promise<CustomField[]> {
  const res = await fetch(`/api/custom-fields/entity/${entity}`, { signal });
  const data = await readJson<CustomField[]>(res);
  return [...data].sort((a, b) => a.order - b.order);
}

// An entity's filter spec (standard filterable fields + their operators).
// Merged with the custom fields to build the field list the filter bar offers.
export async function fetchFilterSpec(
  entity: EntityKey,
  signal?: AbortSignal,
): Promise<FilterSpecification> {
  const res = await fetch(`/api/filters/${entity}`, { signal });
  return readJson<FilterSpecification>(res);
}
