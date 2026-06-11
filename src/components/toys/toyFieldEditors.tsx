"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomFieldOption, CustomFieldType } from "@/lib/api";
import {
  CaretIcon,
  CheckIcon,
  PencilIcon,
} from "@/components/custom-fields/icons";
import BooleanBadge from "@/components/BooleanBadge";
import styles from "./ToyDetail.module.css";

// The minimal view of a field an editor needs. `value` is always the backend's
// string representation ("true"/"false" for boolean, numeric string for number,
// the selected option name for dropdown/radio/progress, "" when unset). Options
// are pre-sorted by order and only present for the option-bearing kinds.
export type EditorField = {
  name: string;
  kind: CustomFieldType;
  value: string;
  options?: CustomFieldOption[];
};

type EditorProps = {
  field: EditorField;
  onCommit: (value: string) => void;
  // When true, the editor opens as soon as it receives focus (rather than
  // waiting for a click/Enter), and a text/number input selects its value so a
  // keystroke overwrites it. Used by the create dialog for fast keyboard entry;
  // the grid and detail page leave it off. Ignored by the boolean/radio/progress
  // editors, which stay click-to-toggle.
  openOnFocus?: boolean;
};

// Coerce a stored value to a valid one for its type, or "" when it isn't —
// so a malformed value (a non-numeric number, a boolean that isn't
// "true"/"false", an option no longer in the list) renders the same "empty"
// state as a missing value rather than something broken.
export function normalizeFieldValue(
  kind: CustomFieldType,
  value: string | undefined,
  options: CustomFieldOption[] = [],
): string {
  if (value == null || value === "") return "";
  switch (kind) {
    case "number":
      return Number.isNaN(Number(value)) ? "" : value;
    case "boolean":
      return value === "true" || value === "false" ? value : "";
    case "dropdown":
    case "radio_button":
    case "progress_bar":
      return options.some((o) => o.name === value) ? value : "";
    case "text":
    default:
      return value;
  }
}

// Text + Number: click the value to open an inline input. Enter/blur commits,
// Esc cancels. A latch keeps the Enter-then-blur sequence from committing twice.
// Numbers coerce via Number() on commit and revert on invalid input.
function TextEditor({ field, onCommit, openOnFocus }: EditorProps) {
  const isNum = field.kind === "number";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.value);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  const open = () => {
    setDraft(field.value);
    done.current = false;
    setEditing(true);
  };
  const commit = () => {
    if (done.current) return;
    done.current = true;
    setEditing(false);
    let v = draft.trim();
    if (isNum && v !== "") {
      const n = Number(v);
      if (Number.isNaN(n)) return; // invalid → revert (no commit)
      v = String(n);
    }
    onCommit(v);
  };
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        className={`${styles.inp}${isNum ? ` ${styles.inpNum}` : ""}`}
        type={isNum ? "number" : "text"}
        aria-label={field.name}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  const empty = field.value === "" || field.value == null;
  return (
    <span
      className={`${styles.editable} ${isNum ? styles.vNum : styles.vText}`}
      tabIndex={0}
      role="button"
      aria-label={`Edit ${field.name}`}
      onClick={open}
      onFocus={openOnFocus ? open : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          open();
        }
      }}
    >
      {empty ? <em className={styles.ph}>Empty</em> : field.value}
      <PencilIcon className={styles.editPen} aria-hidden="true" />
    </span>
  );
}

// Yes/No: the same pill shown in the toys grid, but clickable — clicking
// toggles the value directly.
function YesNoEditor({ field, onCommit }: EditorProps) {
  const on = field.value === "true";
  return (
    <BooleanBadge
      value={on}
      label={field.name}
      onToggle={() => onCommit(on ? "false" : "true")}
    />
  );
}

// Dropdown: a gold trigger that opens a custom listbox of every option (in
// their defined order, as sorted by the caller) — no native <select>, matching
// the custom-fields scope picker. Picking a different option commits it. Closes
// on outside click, Escape, or scroll.
//
// The menu is position:fixed (placed from the trigger's rect) so it escapes
// `overflow:hidden` ancestors — it must show even when the editor lives in a
// clipped, scrollable grid cell. It stays a DOM child of the wrapper, so the
// outside-click check still recognizes clicks inside it.
function DropdownEditor({ field, onCommit, openOnFocus }: EditorProps) {
  const options = field.options ?? [];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // With openOnFocus, a mouse press delivers focus (which opens the menu) and
  // then a click on the same interaction — without this latch the click's
  // toggle would immediately close what the focus just opened.
  const justOpenedByFocus = useRef(false);

  const openMenu = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left, width: r.width });
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
      if (e.key === "Escape") setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    // Capture-phase catches scrolling on any inner container (e.g. the grid).
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div
      className={styles.vDrop}
      ref={wrapRef}
      // With openOnFocus, the menu opens on focus; close it again once focus
      // leaves the wrapper entirely (Tab past the options) so it isn't orphaned.
      onBlur={
        openOnFocus
          ? (e) => {
              if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) {
                setOpen(false);
              }
            }
          : undefined
      }
    >
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.dropTrigger}${open ? ` ${styles.dropOpen}` : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={field.name}
        onFocus={
          openOnFocus && !open
            ? () => {
                justOpenedByFocus.current = true;
                openMenu();
              }
            : undefined
        }
        onClick={() => {
          if (justOpenedByFocus.current) {
            justOpenedByFocus.current = false;
            return;
          }
          if (open) setOpen(false);
          else openMenu();
        }}
      >
        <span className={styles.dropValue}>
          {field.value === "" ? (
            <em className={styles.ph}>Select…</em>
          ) : (
            field.value
          )}
        </span>
        <span className={styles.dropCaret}>
          <CaretIcon />
        </span>
      </button>
      {open && pos && (
        <div
          className={styles.dropMenu}
          role="listbox"
          aria-label={field.name}
          style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
        >
          {options.map((o) => {
            const selected = o.name === field.value;
            return (
              <button
                type="button"
                key={o.id}
                role="option"
                aria-selected={selected}
                className={`${styles.dropOption}${selected ? ` ${styles.dropOptionSelected}` : ""}`}
                onClick={() => {
                  if (o.name !== field.value) onCommit(o.name);
                  setOpen(false);
                }}
              >
                <span className={styles.dropOptionLabel}>{o.name}</span>
                {selected && (
                  <span className={styles.dropOptionCheck}>
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

// Radio: a single-select chip group; clicking a chip commits that option.
function RadioEditor({ field, onCommit }: EditorProps) {
  const options = field.options ?? [];
  return (
    <span className={styles.vRadios} role="radiogroup" aria-label={field.name}>
      {options.map((o) => {
        const sel = o.name === field.value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={sel}
            className={`${styles.vRadio}${sel ? ` ${styles.on}` : ""}`}
            onClick={() => onCommit(o.name)}
          >
            <span className={styles.rdot} />
            {o.name}
          </button>
        );
      })}
    </span>
  );
}

// Progress: an ordered list of named stages shown as chips, like the radio
// editor but teal — selecting a stage fills it and every stage to its left
// (cumulative), so the chips read as a progress bar. The current stage is the
// committed value; clicking any chip sets it.
function ProgressEditor({ field, onCommit }: EditorProps) {
  const options = field.options ?? [];
  const idx = options.findIndex((o) => o.name === field.value);
  return (
    <span className={styles.vRadios} role="radiogroup" aria-label={field.name}>
      {options.map((o, i) => {
        const done = i <= idx;
        const current = i === idx;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={current}
            className={`${styles.progChip}${done ? ` ${styles.progChipDone}` : ""}`}
            onClick={() => onCommit(o.name)}
          >
            {o.name}
          </button>
        );
      })}
    </span>
  );
}

// Routes a field to the right editor by its backend type. Each editor commits a
// string value; the parent merges it into the toy and persists.
export default function FieldEditor({
  field,
  onCommit,
  openOnFocus,
}: EditorProps) {
  switch (field.kind) {
    case "text":
    case "number":
      return (
        <TextEditor field={field} onCommit={onCommit} openOnFocus={openOnFocus} />
      );
    case "boolean":
      return <YesNoEditor field={field} onCommit={onCommit} />;
    case "dropdown":
      return (
        <DropdownEditor
          field={field}
          onCommit={onCommit}
          openOnFocus={openOnFocus}
        />
      );
    case "radio_button":
      return <RadioEditor field={field} onCommit={onCommit} />;
    case "progress_bar":
      return <ProgressEditor field={field} onCommit={onCommit} />;
    default:
      return null;
  }
}
