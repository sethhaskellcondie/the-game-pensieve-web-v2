"use client";

import Listbox from "./Listbox";
import type { FilterFieldDef, FilterOperator } from "./types";
import styles from "./FilterEditor.module.css";

// The value control for a filter, chosen by the field's kind (and operator).
// Always reports its value as a string via onChange (the backend's operand
// contract). Booleans use a Yes/No pair; option kinds offer their option list
// (committing the option's id — enum custom fields filter by option id, with
// no text matching); time uses a date input; everything else uses a
// text/number input.
export default function FilterValueInput({
  field,
  operator,
  value,
  onChange,
  onSubmit,
}: {
  field: FilterFieldDef;
  operator: FilterOperator;
  value: string;
  onChange: (value: string) => void;
  // Called when the user presses Enter in a text/number/date input, so the
  // editor can apply without reaching for the button.
  onSubmit?: () => void;
}) {
  const submitOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit?.();
    }
  };

  // Fields with value/label choices (e.g. system_id → system names) get a
  // listbox of the labels committing the value, for whole-value matches.
  if (
    field.valueOptions &&
    field.valueOptions.length > 0 &&
    (operator === "equals" || operator === "not_equals")
  ) {
    return (
      <Listbox
        value={value}
        options={field.valueOptions.map((o) => ({
          value: o.value,
          label: o.label,
        }))}
        onChange={onChange}
        ariaLabel={`${field.label} value`}
        placeholder="Select…"
        className={styles.valueListbox}
      />
    );
  }

  // Option fields show their option picker when matching a whole value
  // (is / is not) — the only operators the backend offers for enum custom
  // fields. The listbox shows option names but commits the option's id, the
  // operand the backend expects.
  const isOptionKind =
    field.kind === "dropdown" ||
    field.kind === "radio_button" ||
    field.kind === "progress_bar";
  if (
    isOptionKind &&
    (operator === "equals" || operator === "not_equals") &&
    field.options &&
    field.options.length > 0
  ) {
    return (
      <Listbox
        value={value}
        options={field.options.map((o) => ({
          value: String(o.id),
          label: o.name,
        }))}
        onChange={onChange}
        ariaLabel={`${field.label} value`}
        placeholder="Select…"
        className={styles.valueListbox}
      />
    );
  }

  switch (field.kind) {
    case "boolean":
      return (
        <div
          className={styles.boolGroup}
          role="radiogroup"
          aria-label={`${field.label} value`}
        >
          {[
            { v: "true", label: "Yes" },
            { v: "false", label: "No" },
          ].map(({ v, label }) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              className={`${styles.boolBtn}${value === v ? ` ${styles.boolOn}` : ""}`}
              onClick={() => onChange(v)}
            >
              {label}
            </button>
          ))}
        </div>
      );

    case "time":
      return (
        <input
          type="date"
          className={styles.valueInput}
          aria-label={`${field.label} value`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={submitOnEnter}
        />
      );

    case "number":
    case "system":
      return (
        <input
          type="number"
          className={styles.valueInput}
          aria-label={`${field.label} value`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={submitOnEnter}
        />
      );

    case "text":
    default:
      return (
        <input
          type="text"
          className={styles.valueInput}
          aria-label={`${field.label} value`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={submitOnEnter}
        />
      );
  }
}
