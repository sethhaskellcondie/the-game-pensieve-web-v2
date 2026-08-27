import { decodeSortParam, encodeSortParam } from "@/components/filters/urlFilters";
import type { ActiveSort } from "@/components/filters/types";

// One applied level, with the UI-local id the encoder is expected to drop.
function level(overrides: Partial<ActiveSort> = {}): ActiveSort {
  return {
    id: "local-1",
    field: "name",
    label: "Name",
    direction: "asc",
    ...overrides,
  };
}

describe("the sorts URL param", () => {
  it("round-trips levels, keeping their priority order", () => {
    const sorts = [
      level(),
      level({ id: "local-2", field: "set", label: "Set", direction: "desc" }),
    ];
    expect(decodeSortParam(encodeSortParam(sorts))).toEqual([
      { id: "sort-0", field: "name", label: "Name", direction: "asc" },
      { id: "sort-1", field: "set", label: "Set", direction: "desc" },
    ]);
  });

  it("drops the UI-local id when encoding", () => {
    const encoded = encodeSortParam([level()]);
    expect(JSON.parse(encoded)).toEqual([
      { field: "name", label: "Name", direction: "asc" },
    ]);
  });

  it("mints deterministic ids so server and client render alike", () => {
    const param = encodeSortParam([level()]);
    expect(decodeSortParam(param)[0].id).toBe(
      decodeSortParam(param)[0].id,
    );
    expect(decodeSortParam(param)[0].id).toBe("sort-0");
  });

  it("takes the first value when the param repeats", () => {
    const first = encodeSortParam([level()]);
    const second = encodeSortParam([
      level({ field: "set", label: "Set", direction: "desc" }),
    ]);
    expect(decodeSortParam([first, second])[0].field).toBe("name");
  });

  it("falls back to the field token when the label is missing", () => {
    expect(
      decodeSortParam(JSON.stringify([{ field: "set", direction: "desc" }])),
    ).toEqual([{ id: "sort-0", field: "set", label: "set", direction: "desc" }]);
  });

  it("drops levels with no field or an unknown direction", () => {
    expect(
      decodeSortParam(
        JSON.stringify([
          { label: "Nameless", direction: "asc" },
          { field: "set", label: "Set", direction: "sideways" },
          { field: "name", label: "Name", direction: "desc" },
        ]),
      ),
    ).toEqual([{ id: "sort-2", field: "name", label: "Name", direction: "desc" }]);
  });

  it("degrades to no sorts for a missing, corrupt, or non-array param", () => {
    expect(decodeSortParam(undefined)).toEqual([]);
    expect(decodeSortParam("")).toEqual([]);
    expect(decodeSortParam("{not json")).toEqual([]);
    expect(decodeSortParam('{"field":"name"}')).toEqual([]);
  });
});
