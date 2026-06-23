import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import FieldGlyph from "@/components/filters/FieldGlyph";
import { STANDARD_FIELD_META } from "@/components/custom-fields/registry";
import type { FilterFieldDef } from "@/components/filters/types";

function glyph(container: HTMLElement): HTMLElement {
  const span = container.querySelector("span");
  if (!span) throw new Error("FieldGlyph rendered no span");
  return span as HTMLElement;
}

describe("FieldGlyph", () => {
  it("colors a standard field with the standard palette", () => {
    const field: FilterFieldDef = {
      field: "name",
      label: "Name",
      kind: "text",
      source: "standard",
      operators: [],
    };
    const { container } = render(<FieldGlyph field={field} />);
    expect(glyph(container)).toHaveStyle({
      background: STANDARD_FIELD_META.bg,
    });
  });

  it("colors a custom field with its type palette", () => {
    const field: FilterFieldDef = {
      field: "Year",
      label: "Year",
      kind: "number",
      source: "custom",
      operators: [],
    };
    const { container } = render(<FieldGlyph field={field} />);
    // The custom "number" palette, not the neutral standard one.
    expect(glyph(container)).toHaveStyle({ background: "var(--field-purple-bg)" });
  });

  // Regression: a persisted "System" filter chip restores before the field list
  // loads, so FilterBar can't resolve its source and falls back to "custom".
  // "system" isn't a custom-field type, so FIELD_TYPE_META["system"] is
  // undefined — previously this threw "Cannot read properties of undefined
  // (reading 'bg')". The glyph must instead fall back to the standard palette.
  it("renders a system-kind field whose source is unresolved without throwing", () => {
    const field: FilterFieldDef = {
      field: "system_id",
      label: "System",
      kind: "system",
      // The transient fallback FilterBar.sourceOf() returns before fields load.
      source: "custom",
      operators: [],
    };
    expect(() => render(<FieldGlyph field={field} />)).not.toThrow();
    const { container } = render(<FieldGlyph field={field} />);
    expect(glyph(container)).toHaveStyle({
      background: STANDARD_FIELD_META.bg,
    });
  });
});
