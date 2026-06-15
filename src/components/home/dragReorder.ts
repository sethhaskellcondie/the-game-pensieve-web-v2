// The drag-and-drop math for the saved-filter dashboard, kept as pure functions
// so it can be unit-tested without a DOM. The dashboard owns an ordered list of
// categories (`FilterCategory[]`), each holding an ordered list of filter cards.
// Dragging a card both reorders it within its category and moves it to another
// category — both are just edits to where the card sits in this structure, which
// `toStoredFilters` later turns back into `categoryId` + `order`.
//
// dnd-kit identifies the thing under the cursor (`over`) by a droppable id. A
// card's droppable id is its filter id (raw). A category's own droppable id —
// used so a card can be dropped onto an empty category, or onto the padding past
// the last card — is the category id behind the CONTAINER_PREFIX, so the two id
// spaces never collide even if a filter and a category happened to share an id.

import type { FilterCategory } from "./types";

export const CONTAINER_PREFIX = "container:";

// The droppable id a CategorySection registers for its card row.
export function containerId(categoryId: string): string {
  return `${CONTAINER_PREFIX}${categoryId}`;
}

// The index of the category a drop target belongs to, or -1 if unknown. The id
// is either a container id (the category itself) or a filter id (a card, whose
// category is the one holding it).
export function findCategoryIndex(
  rows: FilterCategory[],
  id: string,
): number {
  if (id.startsWith(CONTAINER_PREFIX)) {
    const categoryId = id.slice(CONTAINER_PREFIX.length);
    return rows.findIndex((c) => c.id === categoryId);
  }
  return rows.findIndex((c) => c.filters.some((f) => f.id === id));
}

// Returns a new rows array with the filter `activeId` moved so it sits where
// `overId` is. If `overId` is a card, the active card lands at that card's index
// (mirroring dnd-kit's own `arrayMove`: the card is spliced out, then back in at
// that index — so within one category this matches the live drag preview). If
// `overId` is a category container, the card lands at the end of that category.
// The original `rows` is returned unchanged when the move can't be resolved or a
// card is dropped onto itself.
export function moveFilter(
  rows: FilterCategory[],
  activeId: string,
  overId: string,
): FilterCategory[] {
  if (activeId === overId) return rows;

  const fromCat = rows.findIndex((c) =>
    c.filters.some((f) => f.id === activeId),
  );
  if (fromCat < 0) return rows;
  const fromIdx = rows[fromCat].filters.findIndex((f) => f.id === activeId);

  const toCat = findCategoryIndex(rows, overId);
  if (toCat < 0) return rows;

  // Where in the target the card should land: the over-card's index, or the end
  // when dropped on the category itself.
  const overIsContainer = overId.startsWith(CONTAINER_PREFIX);
  const toIdx = overIsContainer
    ? rows[toCat].filters.length
    : rows[toCat].filters.findIndex((f) => f.id === overId);

  const next = rows.map((c) => ({ ...c, filters: [...c.filters] }));
  const [moving] = next[fromCat].filters.splice(fromIdx, 1);
  // After removal the target list may be one shorter (same-category move), so
  // clamp the insert index into range — this reproduces `arrayMove` exactly.
  const clamped = Math.max(0, Math.min(toIdx, next[toCat].filters.length));
  next[toCat].filters.splice(clamped, 0, moving);
  return next;
}
