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

  const names = [...options]
    .sort((a, b) => a.order - b.order)
    .map((o) => o.name);

  const shown: string[] = [];
  let used = 0;
  for (const name of names) {
    const cost = name.length + 3;
    if (shown.length > 0 && used + cost > BUDGET) break;
    shown.push(name);
    used += cost;
  }
  const extra = names.length - shown.length;

  return (
    <span className={styles.opts}>
      {shown.map((name, idx) => (
        <span key={idx} className={styles.chip}>
          {name}
        </span>
      ))}
      {extra > 0 && (
        <span className={styles.more} title={names.slice(shown.length).join(", ")}>
          +{extra}
        </span>
      )}
    </span>
  );
}
