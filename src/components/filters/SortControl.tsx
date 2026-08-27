"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretIcon, PlusIcon, XIcon } from "@/components/custom-fields/icons";
import { SortIcon } from "@/components/toys/icons";
import { useMobileShelf } from "@/lib/useMobileShelf";
import FieldGlyph from "./FieldGlyph";
import Listbox from "./Listbox";
import { newFilterId } from "./ids";
import type { ActiveSort, FilterFieldDef, SortDirection } from "./types";
import styles from "./SortControl.module.css";

// The Sort button + its popover: an ordered list of sort levels ("Sort by …,
// then by …"), each a field picker plus an Asc/Desc toggle, with reorder and
// remove controls. Fully controlled and live-applying — every change calls
// `onChange` immediately and the parent re-runs its search; the popover stays
// open (closing on outside mousedown or Escape, like the filter editor) so
// multi-level sorts can be built in one sitting. The popover is
// position:fixed, anchored to the trigger's rect, so it escapes any
// clipping/scrolling ancestor (the Options card's overflow:hidden would
// otherwise swallow it) — the same approach as Listbox.
export default function SortControl({
  fields,
  sorts,
  onChange,
  buttonClassName,
  labelClassName,
  ariaLabel = "Sort",
  align = "right",
  onOpenChange,
}: {
  fields: FilterFieldDef[];
  sorts: ActiveSort[];
  onChange: (next: ActiveSort[]) => void;
  // The toolbar button style, passed by FilterBar so the Sort and Filter
  // buttons stay visually identical.
  buttonClassName?: string;
  // Class for the "Sort" text beside the glyph. FilterBar passes the class that
  // clips it on a phone, shrinking the button to its icon; hosts that keep the
  // word at every width (the Options page, the saved-filter dialog) pass
  // nothing. The button's accessible name comes from aria-label either way.
  labelClassName?: string;
  // Accessible name for the button (and the popover, suffixed with
  // "options"). Override it when several SortControls share a page — e.g. the
  // Options page's per-entity default sorts — so each stays distinguishable.
  ariaLabel?: string;
  // Which edge of the trigger the popover aligns to. It defaults to "right"
  // because the toolbar button sits near the bar's right edge; a left-aligned
  // trigger (the saved-filter dialog's) passes "left" so the popover opens
  // over the dialog instead of hanging off its side.
  align?: "left" | "right";
  // Fires whenever the popover opens or closes. Needed by a host that has its
  // own Escape handling to defer to — the saved-filter dialog, which must not
  // close itself while the popover is the thing being dismissed.
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  // Viewport coordinates for the fixed popover, captured from the trigger's
  // rect when it opens: below the button, aligned to the `align` edge of it.
  const [pos, setPos] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Below the breakpoint the popover becomes a shelf: no trigger anchoring, a
  // Done header instead of outside-click dismissal, offset below the page header
  // and sliding in from the right / back out to the right (via useMobileShelf).
  const { isMobile, requestClose, overlayStyle, slideStyle } = useMobileShelf();

  // Every open/close goes through here so the host is always told.
  const changeOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  // Memoized because the open popover re-anchors on scroll/resize through this
  // same function, so the effect below depends on it.
  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) {
      setPos({ top: 8, right: 8 });
      return;
    }
    setPos({
      top: r.bottom + 8,
      ...(align === "left"
        ? { left: r.left }
        : { right: window.innerWidth - r.right }),
    });
  }, [align]);

  const toggle = () => {
    if (open) {
      changeOpen(false);
      return;
    }
    if (!isMobile) place();
    changeOpen(true);
  };

  // Close on outside mousedown or Escape. The Listbox menus render inside the
  // wrap (even though they're position:fixed), so picking an option doesn't
  // count as an outside click; an open Listbox swallows Escape itself. On
  // scroll or resize the fixed popover is re-anchored to the trigger rather
  // than closed — a scroll event can land just after opening (e.g. the
  // browser scrolling the button into view), which would otherwise dismiss
  // the popover the instant it appears.
  // The mobile panel skips the outside/anchoring listeners entirely: it is
  // portaled out of the wrap (so "outside" would match its own content),
  // covers the viewport, and closes via Done or Escape.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Dismissed by keyboard, so hand focus back to the trigger rather than
      // dropping it on the body when the popover unmounts.
      requestClose(() => {
        changeOpen(false);
        buttonRef.current?.focus();
      });
    };
    document.addEventListener("keydown", onKeyDown);
    if (isMobile) {
      return () => {
        document.removeEventListener("keydown", onKeyDown);
      };
    }
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        changeOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, isMobile, requestClose, changeOpen, place]);

  const used = new Set(sorts.map((s) => s.field));

  // Each row's picker offers the unused fields plus its own current field, so
  // two levels can never sort by the same field.
  const optionsFor = (sort: ActiveSort) =>
    fields
      .filter((f) => f.field === sort.field || !used.has(f.field))
      .map((f) => ({
        value: f.field,
        label: f.label,
        leading: <FieldGlyph field={f} />,
      }));

  const pickField = (id: string, token: string) => {
    const next = fields.find((f) => f.field === token);
    if (!next) return;
    onChange(
      sorts.map((s) =>
        s.id === id ? { ...s, field: next.field, label: next.label } : s,
      ),
    );
  };

  const setDirection = (id: string, direction: SortDirection) => {
    onChange(sorts.map((s) => (s.id === id ? { ...s, direction } : s)));
  };

  const remove = (id: string) => {
    onChange(sorts.filter((s) => s.id !== id));
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= sorts.length) return;
    const next = [...sorts];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addLevel = () => {
    const first = fields.find((f) => !used.has(f.field));
    if (!first) return;
    onChange([
      ...sorts,
      {
        id: newFilterId(),
        field: first.field,
        label: first.label,
        direction: "asc",
      },
    ]);
  };

  const canAdd = fields.some((f) => !used.has(f.field));

  // The mobile panel portals to <body> so it escapes the entity pages'
  // z-index: 0 stacking context (which would otherwise trap it under the app
  // Header); the desktop popover stays inline so wrapRef's outside-click
  // detection keeps working.
  const panelPortal = (node: React.ReactNode) =>
    isMobile && node ? createPortal(node, document.body) : node;

  return (
    <span className={styles.anchor} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        disabled={fields.length === 0}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={toggle}
      >
        <SortIcon />
        <span className={labelClassName}>Sort</span>
        {sorts.length > 0 && (
          <span className={styles.count}>{sorts.length}</span>
        )}
      </button>
      {panelPortal(
        open && (isMobile || pos) && (
        <div
          className={`${styles.popover}${isMobile ? ` ${styles.panel}` : ""}`}
          role="dialog"
          aria-label={`${ariaLabel} options`}
          style={
            isMobile
              ? { ...overlayStyle, ...slideStyle }
              : { top: pos!.top, left: pos!.left, right: pos!.right }
          }
        >
          {isMobile && (
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>{ariaLabel}</span>
              {/* On mobile the Add sort / Clear sorting controls ride in the
                  header next to Done (left→right: Clear sorting, Add sort,
                  Done) rather than in a bottom footer. */}
              <div className={styles.panelHeadActions}>
                {sorts.length > 0 && (
                  <button
                    type="button"
                    className={styles.clear}
                    onClick={() => onChange([])}
                  >
                    Clear sorting
                  </button>
                )}
                <button
                  type="button"
                  className={styles.addSort}
                  disabled={!canAdd}
                  onClick={addLevel}
                >
                  <PlusIcon /> Add sort
                </button>
                <button
                  type="button"
                  className={styles.panelDone}
                  onClick={() => requestClose(() => changeOpen(false))}
                >
                  Done
                </button>
              </div>
            </div>
          )}
          {sorts.length === 0 ? (
            <p className={styles.empty}>
              Add sort criteria to override default sort.
            </p>
          ) : (
            <ul className={styles.rows}>
              {sorts.map((sort, i) => (
                <li key={sort.id} className={styles.row}>
                  <span className={styles.prefix}>
                    {i === 0 ? "Sort by" : "then by"}
                  </span>
                  <Listbox
                    value={sort.field}
                    options={optionsFor(sort)}
                    onChange={(token) => pickField(sort.id, token)}
                    ariaLabel={`Sort field ${i + 1}`}
                    className={styles.fieldListbox}
                  />
                  <div
                    className={styles.dirGroup}
                    role="radiogroup"
                    aria-label={`Sort direction ${i + 1}`}
                  >
                    {(
                      [
                        { value: "asc", label: "Asc" },
                        { value: "desc", label: "Desc" },
                      ] as const
                    ).map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={sort.direction === value}
                        className={`${styles.dirBtn}${sort.direction === value ? ` ${styles.dirOn}` : ""}`}
                        onClick={() => setDirection(sort.id, value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={`Move ${sort.label} sort up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <CaretIcon className={styles.caretUp} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={`Move ${sort.label} sort down`}
                      disabled={i === sorts.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <CaretIcon />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.removeBtn}`}
                      aria-label={`Remove ${sort.label} sort`}
                      onClick={() => remove(sort.id)}
                    >
                      <XIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {/* Desktop keeps the Add sort / Clear sorting footer; on mobile these
              live in the panel header (above) instead. */}
          {!isMobile && (
            <div className={styles.foot}>
              <button
                type="button"
                className={styles.addSort}
                disabled={!canAdd}
                onClick={addLevel}
              >
                <PlusIcon /> Add sort
              </button>
              {sorts.length > 0 && (
                <button
                  type="button"
                  className={styles.clear}
                  onClick={() => onChange([])}
                >
                  Clear sorting
                </button>
              )}
            </div>
          )}
        </div>
        ),
      )}
    </span>
  );
}
