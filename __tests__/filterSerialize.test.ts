import { toFilterRequest } from "@/components/filters/serialize";
import type { ActiveFilter } from "@/components/filters/types";

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
