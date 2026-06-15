import { useEffect, useMemo, useState } from "react";
import { toFilterRequest } from "@/components/filters/serialize";
import type { EntityKey, FilterRequestDto } from "@/lib/api";
import type { SavedFilterCondition } from "./types";

// The search route handler for each entity (the same ones the collection pages
// use). A saved filter's match count is just the size of its conditions' result
// set against this endpoint.
const SEARCH_PATHS: Record<EntityKey, string> = {
  toy: "/api/toys/search",
  system: "/api/systems/search",
  videoGame: "/api/video-games/search",
  videoGameBox: "/api/video-game-boxes/search",
  boardGame: "/api/board-games/search",
  boardGameBox: "/api/board-game-boxes/search",
};

// Run the search and return how many records match. Throws on a failed request
// so the caller can leave the count unknown.
async function fetchMatchCount(
  entity: EntityKey,
  filters: FilterRequestDto[],
  signal: AbortSignal,
): Promise<number> {
  const res = await fetch(SEARCH_PATHS[entity], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters }),
    signal,
  });
  const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
  if (!res.ok) throw new Error("Search failed");
  return Array.isArray(body?.data) ? body.data.length : 0;
}

// Live count of records matching a saved filter's conditions, for a card's
// "{n} games" line. Refetches whenever the entity or conditions change (keyed by
// the serialized request, so reordering/renaming doesn't refetch); null while
// loading or after an error.
export function useMatchCount(
  entity: EntityKey,
  conditions: SavedFilterCondition[],
): number | null {
  // The request payload, as a stable string so the effect only re-runs when the
  // conditions actually change (the conditions array is a fresh ref each render).
  const dtoJson = useMemo(
    () => JSON.stringify(toFilterRequest(entity, conditions)),
    [entity, conditions],
  );
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const filters = JSON.parse(dtoJson) as FilterRequestDto[];
    fetchMatchCount(entity, filters, controller.signal)
      .then((c) => {
        if (active) setCount(c);
      })
      .catch(() => {
        // Leave the count unknown ("—") on failure rather than surfacing noise.
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [entity, dtoJson]);

  return count;
}
