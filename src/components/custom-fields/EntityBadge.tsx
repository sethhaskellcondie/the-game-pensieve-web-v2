import type { EntityKey } from "@/lib/api";
import { ENTITY_META } from "./registry";
import styles from "./Badges.module.css";

// The record-type pill: a colored dot + label, used in the edit modal's
// read-only "Applies to" row.
export default function EntityBadge({ entityKey }: { entityKey: EntityKey }) {
  const meta = ENTITY_META[entityKey];
  if (!meta) return null;
  return (
    <span className={styles.ent} style={{ background: meta.bg, color: meta.fg }}>
      <span className={styles.entDot} style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}
