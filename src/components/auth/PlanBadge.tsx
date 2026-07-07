import { roleLabel } from "@/lib/roleLabels";
import type { Role } from "@/lib/sessionConfig";
import styles from "./PlanBadge.module.css";

// The current plan rendered as a colored pill, keyed off the resolved role via
// `data-tier` (the CSS picks the color and uppercases the label). Shared by the
// sidebar AccountMenu (dark surface, light text) and the Account page. Pass
// `onLight` where the badge sits on a light surface so the text stays legible.
export default function PlanBadge({
  role,
  className,
  onLight = false,
}: {
  role: Role;
  className?: string;
  onLight?: boolean;
}) {
  const classes = [styles.badge, onLight ? styles.onLight : null, className]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      className={classes}
      data-tier={role}
      aria-label={`Plan: ${roleLabel(role)}`}
    >
      {roleLabel(role)}
    </span>
  );
}
