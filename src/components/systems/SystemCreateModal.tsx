"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildCustomFieldValues,
  type CustomField,
  type CustomFieldType,
  type CustomFieldOption,
  type CustomFieldValue,
  type UpdateSystemInput,
} from "@/lib/api";
import {
  FIELD_TYPE_META,
  KindGlyph,
  STANDARD_FIELD_META,
  StandardFieldGlyph,
} from "@/components/custom-fields/registry";
import { XIcon } from "@/components/custom-fields/icons";
import { useUiSettings } from "@/components/UiSettingsProvider";
import { useMobileShelf } from "@/lib/useMobileShelf";
import BeginnerHint from "@/components/BeginnerHint";
import { BEGINNER_HINTS } from "@/components/beginnerHints";
import FieldEditor from "@/components/toys/toyFieldEditors";
import rowStyles from "@/components/toys/ToyDetail.module.css";
import styles from "@/components/toys/ToyCreateModal.module.css";

// A field rendered in the create form: the fixed Name/Generation/Handheld rows
// plus one per custom field. Mirrors SystemDetail's Row shape so the same row
// layout drives them all; `kind` reuses the backend types so the standard
// fields borrow the text/number/boolean editors.
type Row = {
  key: string;
  name: string;
  kind: CustomFieldType;
  value: string;
  options?: CustomFieldOption[];
  standard?: boolean;
  onCommit: (value: string) => void;
};

// The default option's name for an option-bearing field, or "" when none is
// marked default (or the field has no options).
function defaultValue(def: CustomField): string {
  return def.options.find((o) => o.isDefault)?.name ?? "";
}

// Currently-focusable elements inside `root`, in DOM (tab) order. Recomputed on
// each Tab so the trap follows the live UI as editors swap triggers for inputs.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

type SystemCreateModalProps = {
  definitions: CustomField[];
  saving: boolean;
  // Persists the system and resolves to whether it succeeded, so the dialog can
  // close (normal) or reset for another entry (mass-input mode) accordingly.
  onCreate: (input: UpdateSystemInput) => Promise<boolean>;
  onClose: () => void;
};

export default function SystemCreateModal({
  definitions,
  saving,
  onCreate,
  onClose,
}: SystemCreateModalProps) {
  // Mass-input mode turns the dialog into a rapid data-entry loop: the button
  // becomes "Create And Add Another", each save clears the form and refocuses
  // Name, and the dialog closes via the X or Escape (no backdrop or Cancel).
  const { settings } = useUiSettings();
  const massInputMode = settings.massInputMode;

  // On mobile the dialog behaves as a shelf: slides in from the right, sits
  // below the header, slides back off to the right on close. requestClose plays that
  // exit before onClose unmounts; on desktop it closes immediately.
  const { requestClose, overlayStyle, slideStyle } = useMobileShelf();

  // Option fields start on their configured default; everything else empty.
  // Shared by the initial state and the post-save reset.
  function makeInitialValues(): Record<number, string> {
    const initial: Record<number, string> = {};
    for (const def of definitions) initial[def.id] = defaultValue(def);
    return initial;
  }

  const [name, setName] = useState("");
  // The number editor speaks strings; "" means generation hasn't been entered
  // yet. Handheld is a required boolean, so the toggle always carries a value
  // and starts on "false" (No).
  const [generation, setGeneration] = useState("");
  const [handheld, setHandheld] = useState("false");
  const [values, setValues] = useState<Record<number, string>>(makeInitialValues);
  // Bumped after each mass-input save to drive the "refocus Name" effect.
  const [entryNonce, setEntryNonce] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const nameCellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Escape always closes the dialog, even in mass-input mode.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose(onClose);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, requestClose]);

  // After a mass-input save, focus the (now blank) Name field — focusing its
  // editor opens it ready to type. Skipped on first mount, where the on-open
  // effect below already focuses Name.
  useEffect(() => {
    if (entryNonce === 0) return;
    nameCellRef.current
      ?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ?.focus();
  }, [entryNonce]);

  // Move focus into the dialog on open, landing on the Name field so a keyboard
  // user can start typing immediately (focusing its editor opens it). Falls back
  // to the first focusable, and returns focus to whatever opened the dialog (the
  // New button) when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const nameEditor =
      nameCellRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (nameEditor ?? getFocusable(modalRef.current)[0])?.focus();
    return () => opener?.focus?.();
  }, []);

  // Keep Tab / Shift+Tab inside the dialog: wrapping past the last focusable
  // returns to the first, and vice versa. Focus that has slipped outside (e.g.
  // after a control unmounts) is pulled back to the appropriate edge.
  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const focusables = getFocusable(modalRef.current);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    const inModal = modalRef.current?.contains(active) ?? false;
    if (e.shiftKey && (!inModal || active === first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (!inModal || active === last)) {
      e.preventDefault();
      first.focus();
    }
  };

  // Generation is a required integer, so Create stays disabled until both Name
  // and a whole-number Generation are entered. (The number editor already
  // reverts non-numeric input; the integer check additionally blocks decimals.)
  const canCreate =
    name.trim().length > 0 &&
    generation !== "" &&
    Number.isInteger(Number(generation)) &&
    !saving;

  // Standard fields first, then the custom fields in their defined order. Each
  // field's onCommit just writes into local state — persistence happens on submit.
  const rows: Row[] = [
    {
      key: "name",
      name: "Name",
      kind: "text",
      value: name,
      standard: true,
      onCommit: setName,
    },
    {
      key: "generation",
      name: "Generation",
      kind: "number",
      value: generation,
      standard: true,
      onCommit: setGeneration,
    },
    {
      key: "handheld",
      name: "Handheld",
      kind: "boolean",
      value: handheld,
      standard: true,
      onCommit: setHandheld,
    },
    ...definitions.map<Row>((def) => {
      const options = [...def.options].sort((a, b) => a.order - b.order);
      return {
        key: `cf-${def.id}`,
        name: def.name,
        kind: def.type,
        value: values[def.id] ?? "",
        options,
        onCommit: (v: string) =>
          setValues((prev) => ({ ...prev, [def.id]: v })),
      };
    }),
  ];

  const submit = async () => {
    if (!canCreate) return;
    // Sends each set field plus every boolean (an untouched boolean shows "No"
    // and is saved as "false"), in the shape SystemDetail/SystemsManager use.
    const customFieldValues: CustomFieldValue[] = buildCustomFieldValues(
      definitions,
      values,
    );
    const ok = await onCreate({
      name: name.trim(),
      generation: Number(generation),
      handheld: handheld === "true",
      customFieldValues,
    });
    // Keep the form (and the user's input) on failure so they can retry.
    if (!ok) return;
    if (massInputMode) {
      // Clear the form for the next entry; the entryNonce effect refocuses Name.
      setName("");
      setGeneration("");
      setHandheld("false");
      setValues(makeInitialValues());
      setEntryNonce((n) => n + 1);
    } else {
      requestClose(onClose);
    }
  };

  // Portal to <body> so the fixed backdrop escapes the page content's stacking
  // context (systems.module.css .content is z-index 0). Rendered inline, the
  // backdrop's z-index 60 is trapped below the Header's z-index-2 .content and
  // the hero logo/title would paint over the modal. document is always defined
  // here — the modal only mounts on a client-side open.
  return createPortal(
    <div
      className={styles.backdrop}
      style={overlayStyle}
      // Mass-input mode disables accidental backdrop-to-close; exit via X/Cancel.
      onMouseDown={massInputMode ? undefined : () => requestClose(onClose)}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        style={slideStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-create-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        <div className={styles.head}>
          <h2 id="system-create-title" className={styles.title}>
            Create System
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={() => requestClose(onClose)}
          >
            <XIcon />
          </button>
        </div>

        <div className={rowStyles.card}>
          {rows.map((row) => {
            const meta = row.standard
              ? STANDARD_FIELD_META
              : FIELD_TYPE_META[row.kind];
            return (
              <div className={rowStyles.row} key={row.key}>
                <div className={rowStyles.rowlabel}>
                  <span
                    className={rowStyles.glyph}
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    {row.standard ? (
                      <StandardFieldGlyph size={15} />
                    ) : (
                      <KindGlyph type={row.kind} size={15} />
                    )}
                  </span>
                  <span className={rowStyles.lblwrap}>
                    <div className={rowStyles.lbl}>{row.name}</div>
                    <div className={rowStyles.lblkind}>{meta.label}</div>
                  </span>
                </div>
                <div
                  className={rowStyles.rowval}
                  ref={row.key === "name" ? nameCellRef : undefined}
                >
                  <FieldEditor
                    field={{
                      name: row.name,
                      kind: row.kind,
                      value: row.value,
                      options: row.options,
                    }}
                    onCommit={row.onCommit}
                    openOnFocus
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.foot}>
          <button
            type="button"
            className={styles.cancel}
            onClick={() => requestClose(onClose)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.save}
            disabled={!canCreate}
            onClick={submit}
          >
            {saving
              ? "Creating…"
              : massInputMode
                ? "Create And Add Another"
                : "Create"}
          </button>
          {!massInputMode && (
            <BeginnerHint
              placement="top-end"
              text={BEGINNER_HINTS.massInputOff}
            />
          )}
          {massInputMode && (
            <BeginnerHint
              placement="top-end"
              text={BEGINNER_HINTS.massInputOn}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
