"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/lib/useMediaQuery";
import { operatorLabel } from "./operators";
import Listbox from "./Listbox";
import FieldGlyph from "./FieldGlyph";
import FilterValueInput from "./FilterValueInput";
import { newFilterId } from "./ids";
import type { ActiveFilter, FilterFieldDef, FilterOperator } from "./types";
import styles from "./FilterEditor.module.css";

// The default operand for a freshly-picked field so a chip is never created
// empty: booleans start "true", option fields start on their default (or first)
// option's id (enum custom fields filter by option id), everything else starts
// blank for the user to fill in.
function defaultOperand(field: FilterFieldDef): string {
  if (field.kind === "boolean") return "true";
  if (field.valueOptions && field.valueOptions.length > 0) {
    return field.valueOptions[0].value;
  }
  if (field.options && field.options.length > 0) {
    const option =
      field.options.find((o) => o.isDefault) ?? field.options[0];
    return String(option.id);
  }
  return "";
}

// The add/edit popover: pick a field, then an operator, then a value. Applying
// emits a complete ActiveFilter (new id, or the edited filter's id). Closes on
// outside mousedown or Escape.
export default function FilterEditor({
  fields,
  initial,
  align = "left",
  onApply,
  onCancel,
}: {
  fields: FilterFieldDef[];
  initial?: ActiveFilter;
  // Which edge of the anchor the popover aligns to. The add button sits on the
  // right of the bar, so its editor opens right-aligned to stay on screen.
  align?: "left" | "right";
  onApply: (filter: ActiveFilter) => void;
  onCancel: () => void;
}) {
  const initialField =
    (initial && fields.find((f) => f.field === initial.field)) ??
    fields[0] ??
    null;

  const [fieldToken, setFieldToken] = useState(initialField?.field ?? "");
  const [operator, setOperator] = useState<FilterOperator>(
    initial?.operator ?? initialField?.operators[0] ?? "equals",
  );
  const [operand, setOperand] = useState(
    initial?.operand ?? (initialField ? defaultOperand(initialField) : ""),
  );

  const panelRef = useRef<HTMLDivElement>(null);
  // Below the breakpoint the popover becomes a full-screen panel: no anchor
  // alignment, a visible title, and stacked
  // controls. The footer's Cancel/Apply already covers dismissal.
  const isMobile = useIsMobile();

  const field = useMemo(
    () => fields.find((f) => f.field === fieldToken) ?? null,
    [fields, fieldToken],
  );

  // Switch field: reset the operator to the field's first and the operand to its
  // default, so the editor never carries an operator/value the new field can't
  // use. (Skipped for the initial field so an edit keeps its values.)
  const pickField = (token: string) => {
    setFieldToken(token);
    const next = fields.find((f) => f.field === token);
    if (next) {
      setOperator(next.operators[0]);
      setOperand(defaultOperand(next));
    }
  };

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onCancel]);

  const canApply = field != null && operand.trim() !== "";

  const apply = () => {
    if (!field || !canApply) return;
    onApply({
      id: initial?.id ?? newFilterId(),
      field: field.field,
      label: field.label,
      kind: field.kind,
      operator,
      operand: operand.trim(),
      options: field.options,
      // Both valueOptions fields (system_id) and enum custom fields carry an
      // id operand; snapshot its display name so the chip stays readable.
      operandLabel:
        field.valueOptions?.find((o) => o.value === operand.trim())?.label ??
        field.options?.find((o) => String(o.id) === operand.trim())?.name,
    });
  };

  const fieldOptions = fields.map((f) => ({
    value: f.field,
    label: f.label,
    leading: <FieldGlyph field={f} />,
  }));
  const operatorOptions = (field?.operators ?? []).map((op) => ({
    value: op,
    label: operatorLabel(op),
  }));

  // The mobile panel portals to <body> so it escapes the entity pages'
  // z-index: 0 stacking context (which would otherwise trap it under the app
  // Header). The outside-mousedown closer keys on panelRef — the panel div
  // itself — so it still resolves correctly through the portal.
  const editor = (
    <div
      ref={panelRef}
      className={`${styles.popover}${
        isMobile
          ? ` ${styles.panel}`
          : align === "right"
            ? ` ${styles.alignRight}`
            : ""
      }`}
      role="dialog"
      aria-label={initial ? "Edit filter" : "Add filter"}
    >
      {isMobile && (
        <div className={styles.panelHead}>
          <span className={styles.panelTitle}>
            {initial ? "Edit filter" : "Add filter"}
          </span>
        </div>
      )}
      <div className={styles.controls}>
        <Listbox
          value={fieldToken}
          options={fieldOptions}
          onChange={pickField}
          ariaLabel="Filter field"
          placeholder="Field…"
          autoFocus
          className={styles.fieldListbox}
        />
        <Listbox
          value={operator}
          options={operatorOptions}
          onChange={(v) => setOperator(v as FilterOperator)}
          ariaLabel="Filter operator"
          className={styles.operatorListbox}
        />
        {field && (
          <FilterValueInput
            field={field}
            operator={operator}
            value={operand}
            onChange={setOperand}
            onSubmit={apply}
          />
        )}
      </div>
      <div className={styles.foot}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.apply}
          disabled={!canApply}
          onClick={apply}
        >
          {initial ? "Update" : "Add"}
        </button>
      </div>
    </div>
  );

  return isMobile ? createPortal(editor, document.body) : editor;
}
