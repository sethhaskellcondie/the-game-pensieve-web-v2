import { act, renderHook } from "@testing-library/react";
import { usePersistentFilters } from "@/components/filters/usePersistentFilters";
import { encodeFilterParam } from "@/components/filters/urlFilters";
import type { ActiveFilter } from "@/components/filters/types";

const STORAGE_KEY = "filters:toy";

function makeFilter(overrides: Partial<ActiveFilter> = {}): ActiveFilter {
  return {
    id: "f1",
    field: "name",
    label: "Name",
    kind: "text",
    operator: "contains",
    operand: "mario",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("usePersistentFilters", () => {
  it("initializes from the URL-seeded filters", () => {
    const seed = [makeFilter()];
    const { result } = renderHook(() => usePersistentFilters("toy", seed));
    expect(result.current[0]).toEqual(seed);
  });

  it("exposes the resolved initial filters for the initial query", () => {
    // No URL seed, but stored filters: resolved reflects storage so the caller's
    // first data query is already filtered.
    const saved = [makeFilter({ operand: "zelda" })];
    localStorage.setItem(STORAGE_KEY, encodeFilterParam(saved));
    const { result } = renderHook(() => usePersistentFilters("toy", []));
    expect(result.current[2]).toEqual([{ ...saved[0], id: "url-0" }]);
  });

  it("resolves to the URL seed when one is present", () => {
    localStorage.setItem(STORAGE_KEY, encodeFilterParam([makeFilter()]));
    const seed = [makeFilter({ operand: "new" })];
    const { result } = renderHook(() => usePersistentFilters("toy", seed));
    expect(result.current[2]).toEqual(seed);
  });

  it("resolves to empty when there is neither a seed nor stored filters", () => {
    const { result } = renderHook(() => usePersistentFilters("toy", []));
    expect(result.current[2]).toEqual([]);
  });

  it("persists filter changes to localStorage", () => {
    const { result } = renderHook(() => usePersistentFilters("toy", []));
    const next = [makeFilter()];
    act(() => {
      result.current[1](next);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(encodeFilterParam(next));
  });

  it("restores the last-used filters on mount when there is no URL param", () => {
    const saved = [makeFilter({ operand: "zelda" })];
    localStorage.setItem(STORAGE_KEY, encodeFilterParam(saved));
    const { result } = renderHook(() => usePersistentFilters("toy", []));
    // Restored filters carry the deterministic url-* ids from decoding.
    expect(result.current[0]).toEqual([
      { ...saved[0], id: "url-0" },
    ]);
  });

  it("lets a URL param win and persists it over previously saved filters", () => {
    localStorage.setItem(
      STORAGE_KEY,
      encodeFilterParam([makeFilter({ operand: "old" })]),
    );
    const seed = [makeFilter({ operand: "new" })];
    const { result } = renderHook(() => usePersistentFilters("toy", seed));
    // The deep-linked filters stay applied...
    expect(result.current[0]).toEqual(seed);
    // ...and replace what was saved.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(encodeFilterParam(seed));
  });

  it("remembers an explicit clear so filters do not reappear", () => {
    localStorage.setItem(
      STORAGE_KEY,
      encodeFilterParam([makeFilter()]),
    );
    const { result } = renderHook(() => usePersistentFilters("toy", []));
    act(() => {
      result.current[1]([]);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("[]");

    // A fresh mount with no URL param keeps the cleared state.
    const second = renderHook(() => usePersistentFilters("toy", []));
    expect(second.result.current[0]).toEqual([]);
  });
});
