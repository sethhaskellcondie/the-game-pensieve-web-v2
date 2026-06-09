"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import type { EntityKey } from "@/lib/api";
import { ENTITY_META, ENTITY_ORDER } from "./registry";
import { CaretIcon, CheckIcon } from "./icons";
import {
  BoardGamesIcon,
  SystemsIcon,
  ToysIcon,
  VideoGamesIcon,
} from "@/components/icons";
import styles from "./EntitySelect.module.css";

// Reuse the same line icons the Sidebar and Header show for each record type,
// so the scope picker matches them. The two "Box" variants have no shared icon
// yet, so they're intentionally left blank for now.
const ENTITY_ICON: Partial<
  Record<EntityKey, ComponentType<SVGProps<SVGSVGElement>>>
> = {
  system: SystemsIcon,
  toy: ToysIcon,
  videoGame: VideoGamesIcon,
  boardGame: BoardGamesIcon,
};

const ICON_SIZE = 18;

// Header dropdown that scopes the table to one record type. Controlled by the
// parent (value + onChange). Closes on outside mousedown and Escape.
export default function EntitySelect({
  value,
  onChange,
}: {
  value: EntityKey;
  onChange: (key: EntityKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = ENTITY_META[value];
  const TriggerIcon = ENTITY_ICON[value];

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={`${styles.trigger}${open ? ` ${styles.on}` : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {TriggerIcon && (
          <span className={styles.triggerIcon}>
            <TriggerIcon width={ICON_SIZE} height={ICON_SIZE} />
          </span>
        )}
        <span className={styles.triggerLabel}>{current.label}</span>
        <span className={styles.caret}>
          <CaretIcon />
        </span>
      </button>
      {open && (
        <div className={styles.menu} role="listbox" aria-label="Record type">
          {ENTITY_ORDER.map((key) => {
            const meta = ENTITY_META[key];
            const OptionIcon = ENTITY_ICON[key];
            const selected = key === value;
            return (
              <button
                type="button"
                key={key}
                role="option"
                aria-selected={selected}
                className={`${styles.option}${selected ? ` ${styles.selected}` : ""}`}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
              >
                <span className={styles.optionIcon}>
                  {OptionIcon && (
                    <OptionIcon width={ICON_SIZE} height={ICON_SIZE} />
                  )}
                </span>
                <span className={styles.optionLabel}>{meta.label}</span>
                {selected && (
                  <span className={styles.optionCheck}>
                    <CheckIcon />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
