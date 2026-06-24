import {
  buildCustomFieldValues,
  type CustomField,
  type CustomFieldOption,
  type CustomFieldType,
} from "@/lib/api";

// Minimal CustomField definition for a given id/type, plus optional options.
const def = (
  id: number,
  type: CustomFieldType,
  options: CustomFieldOption[] = [],
): CustomField => ({
  id,
  name: `Field ${id}`,
  type,
  entityKey: "boardGame",
  order: id,
  options,
});

const option = (
  customFieldId: number,
  id: number,
  name: string,
  isDefault = false,
): CustomFieldOption => ({ id, customFieldId, name, isDefault, order: id });

describe("buildCustomFieldValues", () => {
  it("includes untouched boolean fields as \"false\" so they aren't left blank", () => {
    // The boolean's editor renders an empty value as "No"; the create request
    // must carry that "false" rather than omitting the field.
    const definitions = [def(1, "boolean")];
    const result = buildCustomFieldValues(definitions, {});
    expect(result).toEqual([
      {
        customFieldId: 1,
        customFieldName: "Field 1",
        customFieldType: "boolean",
        value: "false",
        valueOptionId: null,
      },
    ]);
  });

  it("keeps an explicitly-set boolean value", () => {
    const definitions = [def(1, "boolean")];
    const result = buildCustomFieldValues(definitions, { 1: "true" });
    expect(result[0]).toMatchObject({ value: "true" });
  });

  it("omits non-boolean fields left empty (partial upsert)", () => {
    const definitions = [def(1, "text"), def(2, "number")];
    expect(buildCustomFieldValues(definitions, {})).toEqual([]);
  });

  it("includes non-boolean fields that have a value", () => {
    const definitions = [def(1, "text"), def(2, "number")];
    const result = buildCustomFieldValues(definitions, { 1: "hi", 2: "42" });
    expect(result.map((v) => v.value)).toEqual(["hi", "42"]);
  });

  it("resolves enum option ids and skips empty enum fields", () => {
    const opts = [
      option(1, 7, "Sega"),
      option(1, 8, "Nintendo"),
    ];
    const definitions = [def(1, "dropdown", opts), def(2, "dropdown", opts)];
    const result = buildCustomFieldValues(definitions, { 1: "Nintendo" });
    expect(result).toEqual([
      {
        customFieldId: 1,
        customFieldName: "Field 1",
        customFieldType: "dropdown",
        value: "Nintendo",
        valueOptionId: 8,
      },
    ]);
  });

  it("handles a realistic mix: empty booleans sent, empty others dropped", () => {
    const definitions = [
      def(1, "text"),
      def(2, "boolean"), // Cooperative Play
      def(3, "boolean"), // Hall of Fame
      def(4, "number"),
    ];
    const result = buildCustomFieldValues(definitions, { 1: "Catan" });
    expect(result.map((v) => [v.customFieldId, v.value])).toEqual([
      [1, "Catan"],
      [2, "false"],
      [3, "false"],
    ]);
  });
});
