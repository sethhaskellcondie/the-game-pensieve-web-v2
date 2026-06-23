import type { CustomFieldType } from "@/lib/api";
import {
  FIELD_TYPE_META,
  KindGlyph,
  STANDARD_FIELD_META,
  StandardFieldGlyph,
} from "@/components/custom-fields/registry";
import type { FilterFieldDef } from "./types";
import styles from "./FilterBar.module.css";

// The colored glyph chip for a filter field — a shield for standard fields, the
// custom-field type glyph otherwise. Reuses the same metadata/colors as the
// create dialog and detail page so fields read consistently across the app.
export default function FieldGlyph({
  field,
  size = 13,
}: {
  field: FilterFieldDef;
  size?: number;
}) {
  // Treat a field as standard when its source says so, OR when its kind isn't a
  // custom-field type (e.g. "system"/"time" are standard-only). The latter also
  // guards the first render after a navigation, where persisted filter chips
  // restore before the field list loads and the source can't yet be resolved —
  // without it, FIELD_TYPE_META[kind] is undefined and reading meta.bg throws.
  const customMeta = FIELD_TYPE_META[field.kind as CustomFieldType];
  const standard = field.source === "standard" || !customMeta;
  const meta = standard ? STANDARD_FIELD_META : customMeta;
  return (
    <span
      className={styles.glyph}
      style={{ background: meta.bg, color: meta.fg }}
      aria-hidden="true"
    >
      {standard ? (
        <StandardFieldGlyph size={size} />
      ) : (
        <KindGlyph type={field.kind as CustomFieldType} size={size} />
      )}
    </span>
  );
}
