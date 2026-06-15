import {
  CONTAINER_PREFIX,
  containerId,
  findCategoryIndex,
  moveFilter,
} from "@/components/home/dragReorder";
import type { FilterCategory, SavedFilter } from "@/components/home/types";

// A minimal filter — only the id matters to the reorder math.
function f(id: string): SavedFilter {
  return { id, name: id, entity: "toy", conditions: [] };
}

// Three categories: a full one, a single-card one, and an empty Uncategorized.
function board(): FilterCategory[] {
  return [
    { id: "c1", name: "A", filters: [f("a"), f("b"), f("c")] },
    { id: "c2", name: "B", filters: [f("d")] },
    { id: "u", name: "Uncategorized", filters: [] },
  ];
}

// The id ordering of each category, for compact assertions.
function shape(rows: FilterCategory[]): Record<string, string[]> {
  return Object.fromEntries(
    rows.map((c) => [c.id, c.filters.map((x) => x.id)]),
  );
}

describe("containerId / findCategoryIndex", () => {
  test("containerId is prefixed and round-trips to its category", () => {
    expect(containerId("c2")).toBe(`${CONTAINER_PREFIX}c2`);
    expect(findCategoryIndex(board(), containerId("c2"))).toBe(1);
  });

  test("a filter id resolves to the category that holds it", () => {
    expect(findCategoryIndex(board(), "a")).toBe(0);
    expect(findCategoryIndex(board(), "d")).toBe(1);
  });

  test("unknown ids resolve to -1", () => {
    expect(findCategoryIndex(board(), "nope")).toBe(-1);
    expect(findCategoryIndex(board(), containerId("ghost"))).toBe(-1);
  });
});

describe("moveFilter within a category", () => {
  test("forward move lands the card at the over-card's index (like arrayMove)", () => {
    expect(shape(moveFilter(board(), "a", "c"))).toEqual({
      c1: ["b", "c", "a"],
      c2: ["d"],
      u: [],
    });
  });

  test("backward move places the card before the over-card", () => {
    expect(shape(moveFilter(board(), "c", "a"))).toEqual({
      c1: ["c", "a", "b"],
      c2: ["d"],
      u: [],
    });
  });

  test("adjacent swap", () => {
    expect(shape(moveFilter(board(), "a", "b")).c1).toEqual(["b", "a", "c"]);
  });

  test("dropping a card on itself is a no-op (same reference)", () => {
    const rows = board();
    expect(moveFilter(rows, "b", "b")).toBe(rows);
  });

  test("dropping on the card's own category container sends it to the end", () => {
    expect(shape(moveFilter(board(), "a", containerId("c1"))).c1).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});

describe("moveFilter across categories", () => {
  test("dropping over a card inserts at that card's index", () => {
    expect(shape(moveFilter(board(), "a", "d"))).toEqual({
      c1: ["b", "c"],
      c2: ["a", "d"],
      u: [],
    });
  });

  test("dropping on an empty category's container appends there", () => {
    expect(shape(moveFilter(board(), "a", containerId("u")))).toEqual({
      c1: ["b", "c"],
      c2: ["d"],
      u: ["a"],
    });
  });

  test("dropping on a non-empty category's container appends to its end", () => {
    expect(shape(moveFilter(board(), "a", containerId("c2"))).c2).toEqual([
      "d",
      "a",
    ]);
  });

  test("the source rows are not mutated", () => {
    const rows = board();
    moveFilter(rows, "a", "d");
    expect(shape(rows)).toEqual({
      c1: ["a", "b", "c"],
      c2: ["d"],
      u: [],
    });
  });
});
