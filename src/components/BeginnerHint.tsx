"use client";

import { useId, useState } from "react";
import { BeginnerModeIcon } from "./icons";
import { useUiSettings } from "./UiSettingsProvider";
import styles from "./BeginnerHint.module.css";

type Props = {
  // The short explanation revealed when the seedling is clicked.
  text: string;
  // Optional hook for the host to control placement/colors in its context.
  className?: string;
};

// A beginner-mode hint: the seedling icon, which discloses a short explanation
// when clicked. The component checks beginnerMode itself so callers can drop
// one anywhere — it renders nothing while the mode is off.
export default function BeginnerHint({ text, className }: Props) {
  const { settings } = useUiSettings();
  const [open, setOpen] = useState(false);
  const textId = useId();

  if (!settings.beginnerMode) return null;

  return (
    <div className={className ? `${styles.hint} ${className}` : styles.hint}>
      <button
        type="button"
        className={styles.button}
        aria-label="Beginner hint"
        aria-expanded={open}
        aria-controls={open ? textId : undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        <BeginnerModeIcon />
      </button>
      {open && (
        <p id={textId} className={styles.text}>
          {text}
        </p>
      )}
    </div>
  );
}
