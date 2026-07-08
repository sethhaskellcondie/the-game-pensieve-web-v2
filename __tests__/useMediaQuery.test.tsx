import { act, renderHook } from "@testing-library/react";
import {
  MOBILE_BREAKPOINT,
  MOBILE_MEDIA_QUERY,
  useIsMobile,
  useMediaQuery,
} from "@/lib/useMediaQuery";

// jsdom doesn't implement matchMedia; install a controllable stand-in whose
// match state can be flipped per query to simulate viewport changes.
function installMatchMedia() {
  const state = new Map<string, boolean>();
  const listeners = new Map<string, Set<() => void>>();

  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return state.get(query) ?? false;
    },
    addEventListener: (_type: "change", listener: () => void) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)!.add(listener);
    },
    removeEventListener: (_type: "change", listener: () => void) => {
      listeners.get(query)?.delete(listener);
    },
  })) as unknown as typeof window.matchMedia;

  return {
    set(query: string, matches: boolean) {
      state.set(query, matches);
      listeners.get(query)?.forEach((listener) => listener());
    },
    listenerCount(query: string) {
      return listeners.get(query)?.size ?? 0;
    },
  };
}

let media: ReturnType<typeof installMatchMedia>;

beforeEach(() => {
  media = installMatchMedia();
});

describe("useMediaQuery", () => {
  const QUERY = "(max-width: 500px)";

  it("reports false when the query does not match", () => {
    const { result } = renderHook(() => useMediaQuery(QUERY));
    expect(result.current).toBe(false);
  });

  it("reports true when the query matches", () => {
    media.set(QUERY, true);
    const { result } = renderHook(() => useMediaQuery(QUERY));
    expect(result.current).toBe(true);
  });

  it("re-renders when the query flips after mount", () => {
    const { result } = renderHook(() => useMediaQuery(QUERY));
    expect(result.current).toBe(false);

    act(() => media.set(QUERY, true));
    expect(result.current).toBe(true);

    act(() => media.set(QUERY, false));
    expect(result.current).toBe(false);
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useMediaQuery(QUERY));
    expect(media.listenerCount(QUERY)).toBe(1);

    unmount();
    expect(media.listenerCount(QUERY)).toBe(0);
  });
});

describe("useIsMobile", () => {
  it("derives its query from the shared breakpoint constant", () => {
    // Mobile is strictly below the breakpoint, so the max-width sits 1px under.
    expect(MOBILE_MEDIA_QUERY).toBe(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  });

  it("tracks the mobile media query", () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => media.set(MOBILE_MEDIA_QUERY, true));
    expect(result.current).toBe(true);
  });
});
