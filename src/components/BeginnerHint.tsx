"use client";

import { useId, useState } from "react";
import { BeginnerModeIcon } from "./icons";
import { useUiSettings } from "./UiSettingsProvider";
import styles from "./BeginnerHint.module.css";

// Where the tooltip pops out relative to the seedling trigger. The vertical
// half (top/bottom) picks which side it grows toward; the horizontal half
// (start/end) anchors its left or right edge to the trigger so it stays on
// screen near a page edge.
type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

type Props = {
  // The short explanation revealed when the seedling is clicked.
  text: string;
  // Optional hook for the host to control placement/colors in its context.
  className?: string;
  // Side the disclosed tooltip opens toward (default below, left-aligned).
  placement?: Placement;
};

// A beginner-mode hint: the seedling icon, which discloses a short explanation
// as a floating tooltip when clicked, and hides it again on the next click.
// The tooltip overlays neighbouring UI (absolutely positioned, high z-index)
// rather than pushing it. The component checks beginnerMode itself so callers
// can drop one anywhere — it renders nothing while the mode is off.
export default function BeginnerHint({
  text,
  className,
  placement = "bottom-start",
}: Props) {
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
        <p
          id={textId}
          role="tooltip"
          data-placement={placement}
          className={styles.text}
        >
          {text}
        </p>
      )}
    </div>
  );
}
