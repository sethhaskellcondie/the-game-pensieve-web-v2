"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomFieldOption, CustomFieldType } from "@/lib/api";
import { CaretIcon, PencilIcon, SwapIcon } from "@/components/custom-fields/icons";
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
function TextEditor({ field, onCommit }: EditorProps) {
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

// Yes/No: the badge is the control — clicking it toggles directly.
function YesNoEditor({ field, onCommit }: EditorProps) {
  const on = field.value === "true";
  return (
    <button
      type="button"
      className={`${styles.badge} ${on ? styles.badgeYes : styles.badgeNo}`}
      aria-pressed={on}
      aria-label={`${field.name}: ${on ? "Yes" : "No"}`}
      onClick={() => onCommit(on ? "false" : "true")}
    >
      <span className={styles.badgeDot} />
      {on ? "Yes" : "No"}
      <SwapIcon className={styles.editSwap} aria-hidden="true" />
    </button>
  );
}

// Dropdown: click the pill to reveal a native select; change commits + closes.
function DropdownEditor({ field, onCommit }: EditorProps) {
  const options = field.options ?? [];
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && ref.current) ref.current.focus();
  }, [editing]);

  if (editing) {
    return (
      <span className={`${styles.vDrop} ${styles.vDropEdit}`}>
        <select
          ref={ref}
          className={styles.dropSel}
          aria-label={field.name}
          value={field.value}
          onChange={(e) => {
            onCommit(e.target.value);
            setEditing(false);
          }}
          onBlur={() => setEditing(false)}
        >
          {field.value === "" && (
            <option value="" disabled>
              Select…
            </option>
          )}
          {options.map((o) => (
            <option key={o.id} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
        <CaretIcon />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.vDrop} ${styles.editable}`}
      aria-label={`Edit ${field.name}`}
      onClick={() => setEditing(true)}
    >
      {field.value === "" ? <em className={styles.ph}>Empty</em> : field.value}
      <CaretIcon />
    </button>
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

// Progress: an ordered list of named stages. The fill covers everything up to
// and including the current stage; clicking a segment or label sets that stage.
function ProgressEditor({ field, onCommit }: EditorProps) {
  const options = field.options ?? [];
  const idx = options.findIndex((o) => o.name === field.value);
  return (
    <span className={styles.vProg}>
      <span className={styles.progSegs}>
        {options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            className={`${styles.progSeg}${i <= idx ? ` ${styles.done}` : ""}`}
            aria-label={`Set ${field.name} to ${o.name}`}
            title={o.name}
            onClick={() => onCommit(o.name)}
          />
        ))}
      </span>
      <span className={styles.progSteps}>
        {options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            className={`${styles.progStep}${i < idx ? ` ${styles.past}` : ""}${i === idx ? ` ${styles.cur}` : ""}`}
            aria-current={i === idx ? "step" : undefined}
            onClick={() => onCommit(o.name)}
          >
            {o.name}
          </button>
        ))}
      </span>
    </span>
  );
}

// Routes a field to the right editor by its backend type. Each editor commits a
// string value; the parent merges it into the toy and persists.
export default function FieldEditor({ field, onCommit }: EditorProps) {
  switch (field.kind) {
    case "text":
    case "number":
      return <TextEditor field={field} onCommit={onCommit} />;
    case "boolean":
      return <YesNoEditor field={field} onCommit={onCommit} />;
    case "dropdown":
      return <DropdownEditor field={field} onCommit={onCommit} />;
    case "radio_button":
      return <RadioEditor field={field} onCommit={onCommit} />;
    case "progress_bar":
      return <ProgressEditor field={field} onCommit={onCommit} />;
    default:
      return null;
  }
}
