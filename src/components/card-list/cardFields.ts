import type { CustomField, CustomFieldValue } from "@/lib/api";
import { normalizeFieldValue } from "@/components/toys/toyFieldEditors";

// Maps an entity's custom-field values onto the mobile card's slots: the first
// boolean with a value
// becomes the card's corner badge, each progress field gets its own bar row,
// and everything else lands in the single pill row — colored by type with the
// same palette the grid/detail values use (gold dropdown, red radio, purple
// number, blue text). Fields without a value are omitted entirely; the detail
// page remains the complete record.
//
// An entity whose corner badge is a standard field (video game boxes always
// show Physical there) passes `booleanGlyph: false`, sending every boolean
// custom field to the pill row instead.

export type CardGlyph = { label: string; on: boolean };

export type CardBar = {
  key: string;
  // The field's name and its current stage, e.g. Playthrough: "Finished" 3/4.
  name: string;
  stage: string;
  pos: number;
  count: number;
};

export type PillTone = "gold" | "red" | "purple" | "blue";

export type CardPill =
  // `name` is the field's name; shown before the value when the card list's
  // "Show field names" toggle is on. Boolean pills always show their name.
  | { key: string; kind: "value"; tone: PillTone; name: string; label: string }
  | { key: string; kind: "boolean"; label: string; on: boolean };

export type CardCustomFields = {
  glyph: CardGlyph | null;
  bars: CardBar[];
  pills: CardPill[];
};

const VALUE_TONES: Partial<Record<CustomField["type"], PillTone>> = {
  dropdown: "gold",
  radio_button: "red",
  number: "purple",
  text: "blue",
};

export function buildCardCustomFields(
  definitions: CustomField[],
  values: CustomFieldValue[],
  { booleanGlyph = true }: { booleanGlyph?: boolean } = {},
): CardCustomFields {
  let glyph: CardGlyph | null = null;
  const bars: CardBar[] = [];
  const pills: CardPill[] = [];

  for (const def of definitions) {
    const raw = values.find((v) => v.customFieldId === def.id)?.value;
    const value = normalizeFieldValue(def.type, raw ?? undefined, def.options);
    if (value === "") continue;
    const key = `cf-${def.id}`;

    if (def.type === "boolean") {
      const on = value === "true";
      // The first boolean owns the corner badge; any further booleans join
      // the pill row so they aren't lost.
      if (booleanGlyph && glyph === null) glyph = { label: def.name, on };
      else pills.push({ key, kind: "boolean", label: def.name, on });
      continue;
    }

    if (def.type === "progress_bar") {
      const ordered = [...def.options].sort((a, b) => a.order - b.order);
      const pos = ordered.findIndex((o) => o.name === value) + 1;
      bars.push({
        key,
        name: def.name,
        stage: value,
        pos,
        count: ordered.length,
      });
      continue;
    }

    pills.push({
      key,
      kind: "value",
      tone: VALUE_TONES[def.type] ?? "blue",
      name: def.name,
      label: value,
    });
  }

  return { glyph, bars, pills };
}
