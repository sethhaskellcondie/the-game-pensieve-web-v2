// Client-side fetch helpers for the board games pages. They call the Next
// route handlers (the lib/api functions run server-side only) and are shared
// by the list view (BoardGamesManager) and the shelf view
// (BoardGameBoxesManager). The entity-generic helpers (readJson,
// fetchEntityFields, fetchFilterSpec) are reused from the video games module.

import type { BoardGame, BoardGameBox, FilterRequestDto } from "@/lib/api";
import { readJson } from "@/components/video-games/searchClient";
import { bffFetch } from "@/lib/bffClient";

export {
  fetchEntityFields,
  fetchFilterSpec,
  readJson,
} from "@/components/video-games/searchClient";

// Run the backend search through the route handler. An empty filter set
// returns every board game.
export async function searchBoardGamesClient(
  filters: FilterRequestDto[],
  signal?: AbortSignal,
): Promise<BoardGame[]> {
  const res = await bffFetch("/api/board-games/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters }),
    signal,
  });
  return readJson<BoardGame[]>(res);
}

// Same as above for board game boxes — the shelf view's entity.
export async function searchBoardGameBoxesClient(
  filters: FilterRequestDto[],
  signal?: AbortSignal,
): Promise<BoardGameBox[]> {
  const res = await bffFetch("/api/board-game-boxes/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters }),
    signal,
  });
  return readJson<BoardGameBox[]>(res);
}
