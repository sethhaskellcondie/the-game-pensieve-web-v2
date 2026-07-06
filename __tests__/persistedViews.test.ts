import {
  FILTERS_STORAGE_PREFIX,
  SORTS_STORAGE_PREFIX,
  clearPersistedCollectionViews,
} from "@/components/filters/persistedViews";

beforeEach(() => {
  localStorage.clear();
});

describe("clearPersistedCollectionViews", () => {
  it("removes every persisted filter and sort key across entities", () => {
    localStorage.setItem(`${FILTERS_STORAGE_PREFIX}video-game`, "[]");
    localStorage.setItem(`${SORTS_STORAGE_PREFIX}video-game`, "[]");
    localStorage.setItem(`${SORTS_STORAGE_PREFIX}toy`, "[]");

    clearPersistedCollectionViews();

    expect(localStorage.getItem(`${FILTERS_STORAGE_PREFIX}video-game`)).toBeNull();
    expect(localStorage.getItem(`${SORTS_STORAGE_PREFIX}video-game`)).toBeNull();
    expect(localStorage.getItem(`${SORTS_STORAGE_PREFIX}toy`)).toBeNull();
  });

  it("leaves unrelated keys untouched", () => {
    localStorage.setItem("ui_settings:cache", "keep-me");
    localStorage.setItem("colWidths:toy", "keep-me");
    localStorage.setItem(`${SORTS_STORAGE_PREFIX}toy`, "drop-me");

    clearPersistedCollectionViews();

    expect(localStorage.getItem("ui_settings:cache")).toBe("keep-me");
    expect(localStorage.getItem("colWidths:toy")).toBe("keep-me");
    expect(localStorage.getItem(`${SORTS_STORAGE_PREFIX}toy`)).toBeNull();
  });

  it("is a no-op when nothing is stored", () => {
    expect(() => clearPersistedCollectionViews()).not.toThrow();
    expect(localStorage.length).toBe(0);
  });
});
