import {
  SEARCH_FILTER_ID,
  effectiveFilters,
  toFilterRequest,
} from "@/components/filters/serialize";
import { buildFieldList } from "@/components/filters/fieldList";
import type { ActiveFilter } from "@/components/filters/types";
import type { FilterSpecification } from "@/lib/api";

const spec: FilterSpecification = {
  type: "toy",
  fields: { name: "text", set: "text", created_at: "time" },
  filters: {
    name: ["contains"],
    set: ["equals"],
    created_at: ["since", "before"],
  },
};
const fields = buildFieldList(spec, []);

function filter(partial: Partial<ActiveFilter>): ActiveFilter {
  return {
    id: "1",
    field: "set",
    label: "Set",
    kind: "text",
    operator: "equals",
    operand: "Pokemon",
    ...partial,
  };
}

describe("toFilterRequest", () => {
  it("serializes filters with the entity key and string operands", () => {
    const dto = toFilterRequest("toy", [filter({})]);
    expect(dto).toEqual([
      { key: "toy", field: "set", operator: "equals", operand: "Pokemon" },
    ]);
  });

  it("drops filters with an empty operand", () => {
    const dto = toFilterRequest("toy", [
      filter({ id: "1", operand: "" }),
      filter({ id: "2", operand: "   " }),
      filter({ id: "3", operand: "Star Wars" }),
    ]);
    expect(dto).toHaveLength(1);
    expect(dto[0].operand).toBe("Star Wars");
  });

  it("widens a date-only time operand to an ISO datetime", () => {
    const dto = toFilterRequest("toy", [
      filter({ field: "created_at", kind: "time", operator: "since", operand: "2023-01-01" }),
    ]);
    expect(dto[0].operand).toBe("2023-01-01T00:00:00");
  });

  it("trims operands", () => {
    const dto = toFilterRequest("toy", [filter({ operand: "  Mario  " })]);
    expect(dto[0].operand).toBe("Mario");
  });
});

describe("effectiveFilters", () => {
  it("returns the chips unchanged when the query is empty", () => {
    const chips = [filter({})];
    expect(effectiveFilters("   ", chips, fields)).toBe(chips);
  });

  it("appends a name-contains filter for the search text", () => {
    const result = effectiveFilters("mario", [], fields);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: SEARCH_FILTER_ID,
      field: "name",
      operator: "contains",
      operand: "mario",
    });
  });

  it("suppresses the search filter when an explicit name chip exists", () => {
    const nameChip = filter({ field: "name", operand: "R2" });
    const result = effectiveFilters("mario", [nameChip], fields);
    expect(result).toEqual([nameChip]);
  });

  it("returns chips unchanged when there is no searchable text field", () => {
    const noText = buildFieldList(
      { type: "toy", fields: { created_at: "time" }, filters: { created_at: ["since"] } },
      [],
    );
    const chips = [filter({})];
    expect(effectiveFilters("mario", chips, noText)).toBe(chips);
  });
});
