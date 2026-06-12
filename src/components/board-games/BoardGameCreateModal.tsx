"use client";

import { useEffect, useRef, useState } from "react";
import {
  toCustomFieldValue,
  type CustomField,
  type CustomFieldType,
  type CustomFieldOption,
  type CustomFieldValue,
  type NewBoardGameInput,
} from "@/lib/api";
import {
  FIELD_TYPE_META,
  KindGlyph,
  STANDARD_FIELD_META,
  StandardFieldGlyph,
} from "@/components/custom-fields/registry";
import { XIcon } from "@/components/custom-fields/icons";
import { useUiSettings } from "@/components/UiSettingsProvider";
import FieldEditor from "@/components/toys/toyFieldEditors";
import rowStyles from "@/components/toys/ToyDetail.module.css";
import styles from "@/components/toys/ToyCreateModal.module.css";

// Create-a-board-game dialog, the board-games twin of VideoGameCreateModal
// (same focus trap, mass-input loop, and modal chrome — kept in sync by
// reusing its stylesheet). Games are born inside a box, so the caller turns
// the submitted input into a box write. Board games have no system.

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

type BoardGameCreateModalProps = {
  definitions: CustomField[];
  saving: boolean;
  // Persists the game and resolves to whether it succeeded, so the dialog can
  // close (normal) or reset for another entry (mass-input mode) accordingly.
  onCreate: (input: NewBoardGameInput) => Promise<boolean>;
  onClose: () => void;
};

export default function BoardGameCreateModal({
  definitions,
  saving,
  onCreate,
  onClose,
}: BoardGameCreateModalProps) {
  // Mass-input mode turns the dialog into a rapid data-entry loop: the button
  // becomes "Create And Add Another", each save clears the form and refocuses
  // Title, and the dialog only closes via the X (no Escape, backdrop, or Cancel).
  const { settings } = useUiSettings();
  const massInputMode = settings.massInputMode;

  // Option fields start on their configured default; everything else empty.
  // Shared by the initial state and the post-save reset.
  function makeInitialValues(): Record<number, string> {
    const initial: Record<number, string> = {};
    for (const def of definitions) initial[def.id] = defaultValue(def);
    return initial;
  }

  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<number, string>>(makeInitialValues);
  // Bumped after each mass-input save to drive the "refocus Title" effect.
  const [entryNonce, setEntryNonce] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleCellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // In mass-input mode the dialog only exits via a deliberate click (X or
    // Cancel), so the accidental-prone Escape shortcut is inert.
    if (massInputMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, massInputMode]);

  // After a mass-input save, focus the (now blank) Title field — focusing its
  // editor opens it ready to type. Skipped on first mount, which focuses the X.
  useEffect(() => {
    if (entryNonce === 0) return;
    titleCellRef.current
      ?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ?.focus();
  }, [entryNonce]);

  // Move focus into the dialog on open so a keyboard user starts inside it, and
  // return it to whatever opened the dialog (the New button) when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    getFocusable(modalRef.current)[0]?.focus();
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

  const canCreate = title.trim().length > 0 && !saving;

  // Title first, then the custom fields in their defined order. Each field's
  // onCommit just writes into local state — persistence happens on submit.
  const rows: Row[] = [
    {
      key: "title",
      name: "Title",
      kind: "text",
      value: title,
      standard: true,
      onCommit: setTitle,
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
    // Only fields with a non-empty value become CustomFieldValue entries, in
    // the same shape the detail pages send.
    const customFieldValues: CustomFieldValue[] = definitions
      .filter((def) => (values[def.id] ?? "") !== "")
      .map((def) => toCustomFieldValue(def, values[def.id]));
    const ok = await onCreate({
      title: title.trim(),
      customFieldValues,
    });
    // Keep the form (and the user's input) on failure so they can retry.
    if (!ok) return;
    if (massInputMode) {
      // Clear the form for the next entry; the entryNonce effect refocuses
      // Title.
      setTitle("");
      setValues(makeInitialValues());
      setEntryNonce((n) => n + 1);
    } else {
      onClose();
    }
  };

  return (
    <div
      className={styles.backdrop}
      // Mass-input mode disables accidental backdrop-to-close; exit via X/Cancel.
      onMouseDown={massInputMode ? undefined : onClose}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-game-create-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        <div className={styles.head}>
          <h2 id="board-game-create-title" className={styles.title}>
            Create Board Game
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={onClose}
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
                  ref={row.key === "title" ? titleCellRef : undefined}
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
          <button type="button" className={styles.cancel} onClick={onClose}>
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
        </div>
      </div>
    </div>
  );
}
