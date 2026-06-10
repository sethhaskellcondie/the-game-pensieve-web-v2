import type { ReactNode } from "react";
import type { CustomFieldType } from "@/lib/api";
import { CheckIcon } from "@/components/custom-fields/icons";
import styles from "./format.module.css";

// A blank/missing value renders as a muted dash so empty cells read as
// intentional rather than broken.
function placeholder(): ReactNode {
  return <span className={styles.dash}>—</span>;
}

// Turns a custom field's string value into display content based on its type.
// The backend always sends `value` as a string ("true"/"false" for booleans,
// numeric strings for numbers). The switch is the extension point for the
// richer types (dropdown / radio_button / progress_bar) deferred to a follow-up
// — they fall through to the raw string for now so nothing breaks if such a
// field definition appears.
export function formatCustomFieldValue(
  type: CustomFieldType,
  value: string | undefined,
): ReactNode {
  if (value == null || value === "") return placeholder();
  switch (type) {
    case "boolean":
      return value === "true" ? (
        <CheckIcon className={styles.check} aria-label="Yes" role="img" />
      ) : (
        <span className={styles.dash} aria-label="No" role="img">
          —
        </span>
      );
    case "text":
    case "number":
      return value;
    case "dropdown":
    case "radio_button":
    case "progress_bar":
    default:
      return value;
  }
}
