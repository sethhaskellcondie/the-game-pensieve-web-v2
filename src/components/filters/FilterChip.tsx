"use client";

import { XIcon } from "@/components/custom-fields/icons";
import { operatorLabel } from "./operators";
import FieldGlyph from "./FieldGlyph";
import type { ActiveFilter } from "./types";
import styles from "./FilterBar.module.css";

// Render the operand for display: booleans read as Yes/No, everything else shows
// its raw string.
function displayOperand(filter: ActiveFilter): string {
  if (filter.kind === "boolean") return filter.operand === "true" ? "Yes" : "No";
  return filter.operand;
}

// One applied filter as a pill: a colored field glyph, the field label, the
// operator, and the value. The pill body opens the editor; the trailing ✕
// removes the filter.
export default function FilterChip({
  filter,
  fieldSource,
  onEdit,
  onRemove,
}: {
  filter: ActiveFilter;
  // Whether this filter's field is a standard or custom field, for the glyph.
  fieldSource: "standard" | "custom";
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <span className={styles.chip}>
      <button
        type="button"
        className={styles.chipBody}
        aria-label={`Edit ${filter.label} filter`}
        onClick={onEdit}
      >
        <FieldGlyph
          field={{
            field: filter.field,
            label: filter.label,
            kind: filter.kind,
            source: fieldSource,
            operators: [],
            options: filter.options,
          }}
        />
        <span className={styles.chipLabel}>{filter.label}</span>
        <span className={styles.chipOp}>{operatorLabel(filter.operator)}</span>
        <span className={styles.chipVal}>{displayOperand(filter)}</span>
      </button>
      <button
        type="button"
        className={styles.chipRemove}
        aria-label={`Remove ${filter.label} filter`}
        onClick={onRemove}
      >
        <XIcon />
      </button>
    </span>
  );
}
