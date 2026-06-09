import type { CustomFieldType } from "@/lib/api";
import { FIELD_TYPE_META, KindGlyph } from "./registry";
import styles from "./Badges.module.css";

// The type pill: a colored icon holder + label, colors from the registry.
export default function KindBadge({ type }: { type: CustomFieldType }) {
  const meta = FIELD_TYPE_META[type];
  if (!meta) return null;
  return (
    <span
      className={styles.kind}
      style={{ background: meta.bg, color: meta.fg }}
    >
      <span className={styles.kindGlyph}>
        <KindGlyph type={type} size={15} />
      </span>
      {meta.label}
    </span>
  );
}
