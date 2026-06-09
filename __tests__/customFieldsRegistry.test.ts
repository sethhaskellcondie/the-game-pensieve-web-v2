import type { CustomFieldType, EntityKey } from "@/lib/api";
import {
  ENTITY_META,
  ENTITY_ORDER,
  FIELD_TYPE_META,
  FIELD_TYPE_ORDER,
  hasOptions,
} from "@/components/custom-fields/registry";

describe("custom fields registry", () => {
  it("defines metadata for all six backend field types", () => {
    const types: CustomFieldType[] = [
      "text",
      "number",
      "boolean",
      "dropdown",
      "radio_button",
      "progress_bar",
    ];
    for (const type of types) {
      expect(FIELD_TYPE_META[type]).toBeDefined();
      expect(FIELD_TYPE_META[type].label.length).toBeGreaterThan(0);
      expect(FIELD_TYPE_META[type].bg).toMatch(/^#/);
      expect(FIELD_TYPE_META[type].fg).toMatch(/^#/);
    }
  });

  it("maps the prototype's design keys to backend labels", () => {
    expect(FIELD_TYPE_META.boolean.label).toBe("Yes / No");
    expect(FIELD_TYPE_META.progress_bar.label).toBe("Progress Bar");
    expect(FIELD_TYPE_META.radio_button.label).toBe("Radio Button");
  });

  it("flags only the option-bearing types via hasOptions", () => {
    expect(hasOptions("dropdown")).toBe(true);
    expect(hasOptions("radio_button")).toBe(true);
    expect(hasOptions("progress_bar")).toBe(true);
    expect(hasOptions("text")).toBe(false);
    expect(hasOptions("number")).toBe(false);
    expect(hasOptions("boolean")).toBe(false);
  });

  it("orders the type picker with all six types and no duplicates", () => {
    expect(FIELD_TYPE_ORDER).toHaveLength(6);
    expect(new Set(FIELD_TYPE_ORDER).size).toBe(6);
  });

  it("defines metadata for all six entities", () => {
    const keys: EntityKey[] = [
      "toy",
      "system",
      "videoGame",
      "videoGameBox",
      "boardGame",
      "boardGameBox",
    ];
    for (const key of keys) {
      expect(ENTITY_META[key]).toBeDefined();
      expect(ENTITY_META[key].label.length).toBeGreaterThan(0);
      expect(ENTITY_META[key].bg).toMatch(/^#/);
      expect(ENTITY_META[key].fg).toMatch(/^#/);
      expect(ENTITY_META[key].dot).toMatch(/^#/);
    }
  });

  it("orders the entity dropdown with all six entities, Board Game default present", () => {
    expect(ENTITY_ORDER).toHaveLength(6);
    expect(new Set(ENTITY_ORDER).size).toBe(6);
    expect(ENTITY_ORDER).toContain("boardGame");
  });
});
