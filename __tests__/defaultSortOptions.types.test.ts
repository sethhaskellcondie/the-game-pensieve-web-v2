import {
  EMPTY_DEFAULT_SORT_OPTIONS,
  asDefaultSortOptions,
  parseDefaultSortOptionsValue,
  serializeDefaultSortOptions,
  type DefaultSortOptions,
} from "@/lib/defaultSortOptions.types";

describe("serializeDefaultSortOptions / parseDefaultSortOptionsValue", () => {
  it("round-trips every entity through the stored snake_case keys", () => {
    const options: DefaultSortOptions = {
      toy: [{ field: "name", direction: "asc" }],
      system: [
        { field: "generation", direction: "desc" },
        { field: "name", direction: "asc" },
      ],
      videoGame: [{ field: "title", direction: "asc" }],
      videoGameBox: [{ field: "title", direction: "desc" }],
      boardGame: [{ field: "title", direction: "asc" }],
      boardGameBox: [{ field: "title", direction: "desc" }],
    };

    expect(parseDefaultSortOptionsValue(serializeDefaultSortOptions(options))).toEqual(
      options,
    );
  });

  it("stores snake_case entity keys", () => {
    const stored = JSON.parse(
      serializeDefaultSortOptions(EMPTY_DEFAULT_SORT_OPTIONS),
    ) as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual([
      "board_game",
      "board_game_box",
      "system",
      "toy",
      "video_game",
      "video_game_box",
    ]);
  });

  it("falls back to no defaults on malformed JSON", () => {
    expect(parseDefaultSortOptionsValue("not json")).toEqual(
      EMPTY_DEFAULT_SORT_OPTIONS,
    );
  });

  it("falls back to no defaults for missing entities", () => {
    expect(parseDefaultSortOptionsValue("{}")).toEqual(
      EMPTY_DEFAULT_SORT_OPTIONS,
    );
  });
});

describe("asDefaultSortOptions", () => {
  it("drops levels without a usable field and defaults direction to asc", () => {
    const narrowed = asDefaultSortOptions({
      system: [
        { field: "name" },
        { field: "generation", direction: "sideways" },
        { field: "" },
        { direction: "desc" },
        "junk",
        { field: "handheld", direction: "desc" },
      ],
    });

    expect(narrowed.system).toEqual([
      { field: "name", direction: "asc" },
      { field: "generation", direction: "asc" },
      { field: "handheld", direction: "desc" },
    ]);
  });

  it("treats non-array entities and non-object input as no defaults", () => {
    expect(asDefaultSortOptions({ system: "name" }).system).toEqual([]);
    expect(asDefaultSortOptions(null)).toEqual(EMPTY_DEFAULT_SORT_OPTIONS);
  });
});
