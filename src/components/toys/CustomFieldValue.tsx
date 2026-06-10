import type { CustomFieldOption, CustomFieldType } from "@/lib/api";
import BooleanBadge from "@/components/BooleanBadge";
import { normalizeFieldValue } from "./toyFieldEditors";
import styles from "./CustomFieldValue.module.css";

// Read-only display of a custom field's value, styled to match the toy detail
// page (gold dropdown pill, red radio chip, teal progress bar, purple number,
// Yes/No badge). Used in the toys grid so cells read the same as the detail
// screen. Compact by design: the grid's fixed-height rows show the selected
// radio option as a single chip and the progress bar without stage labels.
// Invalid/missing values fall back to a muted dash (the grid's empty convention).
export default function CustomFieldValue({
  type,
  value,
  options = [],
}: {
  type: CustomFieldType;
  value: string | undefined;
  options?: CustomFieldOption[];
}) {
  const v = normalizeFieldValue(type, value, options);
  if (v === "") return <span className={styles.dash}>—</span>;

  switch (type) {
    case "number":
      return <span className={styles.num}>{v}</span>;

    case "boolean":
      return <BooleanBadge value={v === "true"} />;

    case "dropdown":
      return (
        <span className={styles.pill}>
          <span className={styles.pillLabel}>{v}</span>
        </span>
      );

    case "radio_button":
      return (
        <span className={styles.chip}>
          <span className={styles.chipDot} />
          {v}
        </span>
      );

    case "progress_bar": {
      const ordered = [...options].sort((a, b) => a.order - b.order);
      const idx = ordered.findIndex((o) => o.name === v);
      return (
        <span className={styles.prog} role="img" aria-label={v}>
          {ordered.map((o, i) => (
            <span
              key={o.id}
              className={`${styles.progSeg}${i <= idx ? ` ${styles.progDone}` : ""}`}
            />
          ))}
        </span>
      );
    }

    case "text":
    default:
      return <>{v}</>;
  }
}
