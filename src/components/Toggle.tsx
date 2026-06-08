import styles from "./Toggle.module.css";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
};

// Accessible, controlled switch. Rendered as a button with role="switch" and an
// aria-label so it is reachable by accessible name and exposes its state via
// aria-checked (preferred over asserting on CSS classes). When disabled, the
// button can't be toggled (e.g. while a write is being confirmed).
export default function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.toggle}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}
