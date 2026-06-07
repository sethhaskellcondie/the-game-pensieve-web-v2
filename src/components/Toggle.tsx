import styles from "./Toggle.module.css";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
};

// Accessible, controlled switch. Rendered as a button with role="switch" and an
// aria-label so it is reachable by accessible name and exposes its state via
// aria-checked (preferred over asserting on CSS classes).
export default function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.toggle}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}
