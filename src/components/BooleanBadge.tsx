import { CheckIcon, XIcon } from "@/components/custom-fields/icons";
import styles from "./BooleanBadge.module.css";

// The shared Yes/No pill: a green check + "Yes" or a red X + "No". Static by
// default (a labelled <span> for display, e.g. the toys grid). Pass `onToggle`
// to render the same pill as a clickable <button> that flips the value — used
// for inline editing on the toy detail page. `label` names the field so the
// interactive button reads e.g. "Articulated: Yes".
export default function BooleanBadge({
  value,
  onToggle,
  label,
}: {
  value: boolean;
  onToggle?: () => void;
  label?: string;
}) {
  const cls = `${styles.badge} ${value ? styles.yes : styles.no}`;
  const word = value ? "Yes" : "No";
  const content = (
    <>
      {value ? <CheckIcon aria-hidden="true" /> : <XIcon aria-hidden="true" />}{" "}
      {word}
    </>
  );

  if (onToggle) {
    return (
      <button
        type="button"
        className={cls}
        aria-pressed={value}
        aria-label={label ? `${label}: ${word}` : word}
        onClick={onToggle}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={cls} role="img" aria-label={word}>
      {content}
    </span>
  );
}
