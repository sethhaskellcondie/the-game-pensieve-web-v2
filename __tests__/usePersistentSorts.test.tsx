import { act, renderHook } from "@testing-library/react";
import { usePersistentSorts } from "@/components/filters/usePersistentSorts";
import type { ActiveSort } from "@/components/filters/types";

const STORAGE_KEY = "sorts:toy";

function makeSort(overrides: Partial<ActiveSort> = {}): ActiveSort {
  return {
    id: "s1",
    field: "name",
    label: "Name",
    direction: "asc",
    ...overrides,
  };
}

// The stored shape drops the UI-local id; restored levels get fresh ids, so
// comparisons ignore id and assert on the persisted field/label/direction.
function stripIds(sorts: ActiveSort[]) {
  return sorts.map(({ id: _id, ...rest }) => rest);
}

function store(sorts: ActiveSort[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stripIds(sorts)));
}

beforeEach(() => {
  localStorage.clear();
});

describe("usePersistentSorts", () => {
  it("starts empty when there are no stored sorts", () => {
    const { result } = renderHook(() => usePersistentSorts("toy"));
    expect(result.current[0]).toEqual([]);
    expect(result.current[2]).toEqual([]);
  });

  it("exposes the resolved stored sorts for the initial query", () => {
    const saved = [makeSort({ direction: "desc" })];
    store(saved);
    const { result } = renderHook(() => usePersistentSorts("toy"));
    expect(stripIds(result.current[2])).toEqual(stripIds(saved));
  });

  it("restores the last-used sorts into state on mount", () => {
    const saved = [
      makeSort(),
      makeSort({ field: "set", label: "Set", direction: "desc" }),
    ];
    store(saved);
    const { result } = renderHook(() => usePersistentSorts("toy"));
    expect(stripIds(result.current[0])).toEqual(stripIds(saved));
  });

  it("persists sort changes to localStorage", () => {
    const { result } = renderHook(() => usePersistentSorts("toy"));
    const next = [makeSort({ direction: "desc" })];
    act(() => {
      result.current[1](next);
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(
      stripIds(next),
    );
  });

  it("remembers an explicit clear so the sort does not reappear", () => {
    store([makeSort()]);
    const { result } = renderHook(() => usePersistentSorts("toy"));
    act(() => {
      result.current[1]([]);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("[]");

    // A fresh mount keeps the cleared state (so the entity default applies).
    const second = renderHook(() => usePersistentSorts("toy"));
    expect(second.result.current[0]).toEqual([]);
  });

  it("drops malformed levels (missing field or bad direction) defensively", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { field: "name", label: "Name", direction: "asc" },
        { label: "No Field", direction: "asc" },
        { field: "set", label: "Set", direction: "sideways" },
      ]),
    );
    const { result } = renderHook(() => usePersistentSorts("toy"));
    expect(stripIds(result.current[0])).toEqual([
      { field: "name", label: "Name", direction: "asc" },
    ]);
  });

  it("degrades to empty when stored JSON is corrupt", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    const { result } = renderHook(() => usePersistentSorts("toy"));
    expect(result.current[0]).toEqual([]);
  });
});
