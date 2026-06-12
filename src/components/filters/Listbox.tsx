"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CaretIcon, CheckIcon } from "@/components/custom-fields/icons";
import styles from "./Listbox.module.css";

export type ListboxOption = {
  value: string;
  label: string;
  // Optional leading content (e.g. a colored field glyph) shown in both the
  // trigger and the option row.
  leading?: ReactNode;
};

// A small custom listbox: a button trigger plus a position:fixed menu so it
// escapes any clipping/scrolling ancestor (the same approach as the toy
// DropdownEditor and EntitySelect). The menu is viewport-aware: its height is
// clamped to the space on its side of the trigger, and it flips above the
// trigger when there's more room there — otherwise a trigger near the bottom
// edge leaves the menu's tail (and its last options) unreachable off-screen.
// Closes on outside mousedown, Escape, scroll, or resize. Controlled by
// `value` + `onChange`.
export default function Listbox({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Select…",
  autoFocus = false,
  className,
}: {
  value: string;
  options: ListboxOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The menu's natural height cap (mirrors .menu's max-height) and the gap to
  // the trigger / breathing room kept from the viewport edge.
  const MENU_MAX = 280;
  const GAP = 6;
  const MARGIN = 8;

  const openMenu = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const below = window.innerHeight - r.bottom - GAP - MARGIN;
      const above = r.top - GAP - MARGIN;
      // Open downward when the full menu fits (or down is the roomier side),
      // clamped to the available space; otherwise flip above the trigger. The
      // floor keeps the menu usable even in a pathologically short viewport.
      const fit = (space: number) => Math.min(MENU_MAX, Math.max(120, space));
      if (below >= MENU_MAX || below >= above) {
        setPos({
          top: r.bottom + GAP,
          left: r.left,
          width: r.width,
          maxHeight: fit(below),
        });
      } else {
        setPos({
          bottom: window.innerHeight - r.top + GAP,
          left: r.left,
          width: r.width,
          maxHeight: fit(above),
        });
      }
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    // Close when an outer container scrolls (the fixed menu would otherwise
    // detach from its trigger), but NOT when the menu scrolls its own option
    // list — that's how the user reaches options below the fold. The capture
    // listener sees inner scrolls too, so guard on the event target.
    const onScroll = (e: Event) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <div className={`${styles.wrap}${className ? ` ${className}` : ""}`} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger}${open ? ` ${styles.open}` : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        {selected?.leading}
        <span className={styles.value}>
          {selected ? (
            selected.label
          ) : (
            <em className={styles.placeholder}>{placeholder}</em>
          )}
        </span>
        <span className={styles.caret}>
          <CaretIcon />
        </span>
      </button>
      {open && pos && (
        <div
          className={styles.menu}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            top: pos.top,
            bottom: pos.bottom,
            left: pos.left,
            minWidth: pos.width,
            maxHeight: pos.maxHeight,
          }}
        >
          {options.map((o) => {
            const isSelected = o.value === value;
            return (
              <button
                type="button"
                key={o.value}
                role="option"
                aria-selected={isSelected}
                className={`${styles.option}${isSelected ? ` ${styles.optionSelected}` : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                {o.leading}
                <span className={styles.optionLabel}>{o.label}</span>
                {isSelected && (
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
