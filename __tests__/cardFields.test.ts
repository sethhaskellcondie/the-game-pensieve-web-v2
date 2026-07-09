import type { CustomField, CustomFieldValue } from "@/lib/api";
import { buildCardCustomFields } from "@/components/card-list/cardFields";

// The card adapter's contract: first boolean
// with a value → corner glyph; further booleans → boolean pills; progress →
// bar rows; dropdown/radio/number/text → tone pills; unset/invalid → omitted.

const defs: CustomField[] = [
  { id: 1, name: "Favorite", type: "boolean", entityKey: "videoGame", order: 0, options: [] },
  { id: 2, name: "Beaten", type: "boolean", entityKey: "videoGame", order: 1, options: [] },
  {
    id: 3,
    name: "Playthrough",
    type: "progress_bar",
    entityKey: "videoGame",
    order: 2,
    options: [
      { id: 31, customFieldId: 3, name: "Started", isDefault: true, order: 0 },
      { id: 32, customFieldId: 3, name: "Played", isDefault: false, order: 1 },
      { id: 33, customFieldId: 3, name: "Finished", isDefault: false, order: 2 },
    ],
  },
  {
    id: 4,
    name: "Genre",
    type: "dropdown",
    entityKey: "videoGame",
    order: 3,
    options: [
      { id: 41, customFieldId: 4, name: "Action", isDefault: true, order: 0 },
    ],
  },
  {
    id: 5,
    name: "Copy",
    type: "radio_button",
    entityKey: "videoGame",
    order: 4,
    options: [
      { id: 51, customFieldId: 5, name: "Original", isDefault: true, order: 0 },
    ],
  },
  { id: 6, name: "Year", type: "number", entityKey: "videoGame", order: 5, options: [] },
  { id: 7, name: "Developer", type: "text", entityKey: "videoGame", order: 6, options: [] },
];

function value(
  customFieldId: number,
  v: string,
  type: CustomField["type"] = "text",
): CustomFieldValue {
  return {
    customFieldId,
    customFieldName: `field-${customFieldId}`,
    customFieldType: type,
    value: v,
    valueOptionId: null,
  };
}

describe("buildCardCustomFields", () => {
  it("routes every set field to its card slot", () => {
    const { glyph, bars, pills } = buildCardCustomFields(defs, [
      value(1, "true", "boolean"),
      value(2, "false", "boolean"),
      value(3, "Played", "progress_bar"),
      value(4, "Action", "dropdown"),
      value(5, "Original", "radio_button"),
      value(6, "1993", "number"),
      value(7, "Nintendo", "text"),
    ]);

    // First boolean owns the corner; the second becomes a boolean pill.
    expect(glyph).toEqual({ label: "Favorite", on: true });
    expect(bars).toEqual([
      { key: "cf-3", name: "Playthrough", stage: "Played", pos: 2, count: 3 },
    ]);
    expect(pills).toEqual([
      { key: "cf-2", kind: "boolean", label: "Beaten", on: false },
      { key: "cf-4", kind: "value", tone: "gold", name: "Genre", label: "Action" },
      { key: "cf-5", kind: "value", tone: "red", name: "Copy", label: "Original" },
      { key: "cf-6", kind: "value", tone: "purple", name: "Year", label: "1993" },
      { key: "cf-7", kind: "value", tone: "blue", name: "Developer", label: "Nintendo" },
    ]);
  });

  it("omits unset fields entirely and lets a later boolean take the glyph", () => {
    const { glyph, bars, pills } = buildCardCustomFields(defs, [
      // Favorite has no value; Beaten is set, so it gets the corner.
      value(2, "false", "boolean"),
    ]);
    expect(glyph).toEqual({ label: "Beaten", on: false });
    expect(bars).toEqual([]);
    expect(pills).toEqual([]);
  });

  it("drops invalid values (unknown option, non-numeric number)", () => {
    const { glyph, bars, pills } = buildCardCustomFields(defs, [
      value(3, "Not a stage", "progress_bar"),
      value(4, "Not an option", "dropdown"),
      value(6, "not-a-number", "number"),
    ]);
    expect(glyph).toBeNull();
    expect(bars).toEqual([]);
    expect(pills).toEqual([]);
  });

  it("sends every boolean to the pill row when the corner badge is reserved", () => {
    // Video game boxes always show Physical (a standard field) in the corner,
    // so their boolean custom fields must all land as pills.
    const { glyph, pills } = buildCardCustomFields(
      defs,
      [value(1, "true", "boolean"), value(2, "false", "boolean")],
      { booleanGlyph: false },
    );
    expect(glyph).toBeNull();
    expect(pills).toEqual([
      { key: "cf-1", kind: "boolean", label: "Favorite", on: true },
      { key: "cf-2", kind: "boolean", label: "Beaten", on: false },
    ]);
  });

  it("returns nothing for an entity with no custom field values", () => {
    expect(buildCardCustomFields(defs, [])).toEqual({
      glyph: null,
      bars: [],
      pills: [],
    });
  });
});
