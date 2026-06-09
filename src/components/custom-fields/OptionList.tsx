import type { CustomFieldOption } from "@/lib/api";
import styles from "./OptionList.module.css";

// Approximate number of characters that fit on one row before collapsing the
// remainder into a "+N" counter (prevents mid-chip clipping for long labels).
const BUDGET = 40;

// Renders option chips for option-bearing fields; a muted dash otherwise.
// Overflow past the character budget collapses to "+N" with the remaining
// option names in the title. Mirrors cf-grid.jsx OptionList.
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

  const shown: typeof sorted = [];
  let used = 0;
  for (const opt of sorted) {
    const cost = opt.name.length + 3;
    if (shown.length > 0 && used + cost > BUDGET) break;
    shown.push(opt);
    used += cost;
  }
  const extra = sorted.length - shown.length;

  return (
    <span className={styles.opts}>
      {shown.map((opt, idx) => (
        <span key={idx} className={styles.chip}>
          {opt.name}
          {opt.isDefault && (
            <span className={styles.defaultStar} title="Default option">
              *
            </span>
          )}
        </span>
      ))}
      {extra > 0 && (
        <span
          className={styles.more}
          title={sorted.slice(shown.length).map((o) => o.name).join(", ")}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
