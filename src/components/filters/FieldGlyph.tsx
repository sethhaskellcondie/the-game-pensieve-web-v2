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
  const standard = field.source === "standard";
  const meta = standard
    ? STANDARD_FIELD_META
    : FIELD_TYPE_META[field.kind as CustomFieldType];
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
