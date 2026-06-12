import type { CustomFieldOption } from "@/lib/api";
import styles from "./OptionList.module.css";

// Renders option chips for option-bearing fields; a muted dash otherwise.
// All options render; long lists wrap onto additional rows.
export default function OptionList({
  options,
}: {
  options: CustomFieldOption[];
}) {
  if (!options || options.length === 0) {
    return <span className={styles.noOpt}>N/A</span>;
  }

  const sorted = [...options]
    .sort((a, b) => a.order - b.order)
    .map((o) => ({ name: o.name, isDefault: o.isDefault }));

  return (
    <span className={styles.opts}>
      {sorted.map((opt, idx) => (
        <span key={idx} className={styles.chip}>
          {opt.name}
          {opt.isDefault && (
            <span className={styles.defaultStar} title="Default option">
              *
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
