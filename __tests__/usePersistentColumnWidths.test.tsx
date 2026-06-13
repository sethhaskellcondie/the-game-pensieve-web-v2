import { act, renderHook } from "@testing-library/react";
import { usePersistentColumnWidths } from "@/components/data-table/usePersistentColumnWidths";

const COLUMNS = [
  { key: "name", width: 200 },
  { key: "generation", width: 110 },
];

const STORAGE_KEY = "colWidths:systems";

beforeEach(() => {
  localStorage.clear();
});

describe("usePersistentColumnWidths", () => {
  it("initializes from the column defaults", () => {
    const { result } = renderHook(() =>
      usePersistentColumnWidths("systems", COLUMNS),
    );
    expect(result.current[0]).toEqual({ name: 200, generation: 110 });
  });

  it("persists width changes to localStorage", () => {
    const { result } = renderHook(() =>
      usePersistentColumnWidths("systems", COLUMNS),
    );
    act(() => {
      result.current[1]((w) => ({ ...w, name: 320 }));
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toEqual({
      name: 320,
      generation: 110,
    });
  });

  it("merges saved widths over the defaults on mount", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: 400 }));
    const { result } = renderHook(() =>
      usePersistentColumnWidths("systems", COLUMNS),
    );
    // generation keeps its default; name picks up the saved value.
    expect(result.current[0]).toEqual({ name: 400, generation: 110 });
  });

  it("keeps saved widths for not-yet-present columns but ignores non-numeric values", () => {
    // `cf-99` is a custom-field column that loads asynchronously and isn't in
    // COLUMNS yet on mount; its saved width must survive so it applies once the
    // column appears. A non-numeric entry is still ignored.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ name: 400, "cf-99": 250, generation: "wide" }),
    );
    const { result } = renderHook(() =>
      usePersistentColumnWidths("systems", COLUMNS),
    );
    expect(result.current[0]).toEqual({
      name: 400,
      generation: 110,
      "cf-99": 250,
    });
  });

  it("does not touch localStorage when no storage key is given", () => {
    const { result } = renderHook(() =>
      usePersistentColumnWidths(undefined, COLUMNS),
    );
    act(() => {
      result.current[1]((w) => ({ ...w, name: 320 }));
    });
    expect(localStorage.length).toBe(0);
    expect(result.current[0]).toEqual({ name: 320, generation: 110 });
  });
});
