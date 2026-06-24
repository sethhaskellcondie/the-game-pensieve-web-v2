"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildCustomFieldValues,
  type CustomField,
  type CustomFieldType,
  type CustomFieldOption,
  type CustomFieldValue,
  type NewVideoGameInput,
  type System,
} from "@/lib/api";
import {
  FIELD_TYPE_META,
  KindGlyph,
  STANDARD_FIELD_META,
  StandardFieldGlyph,
} from "@/components/custom-fields/registry";
import { XIcon } from "@/components/custom-fields/icons";
import { useUiSettings } from "@/components/UiSettingsProvider";
import BeginnerHint from "@/components/BeginnerHint";
import { BEGINNER_HINTS } from "@/components/beginnerHints";
import FieldEditor from "@/components/toys/toyFieldEditors";
import rowStyles from "@/components/toys/ToyDetail.module.css";
import styles from "@/components/toys/ToyCreateModal.module.css";

// Create-a-video-game dialog, the video-games twin of ToyCreateModal (same
// focus trap, mass-input loop, and modal chrome — kept in sync by reusing its
// stylesheet). Games are born inside a box, so the caller turns the submitted
// input into a box write; the System row defaults to the box's system.

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

type VideoGameCreateModalProps = {
  definitions: CustomField[];
  systems: System[];
  // The box's system — the System row's starting value.
  defaultSystemId: number | undefined;
  // Seeds the Title field — the box dialog passes its own title so a game
  // created from it starts from the same name. Defaults to empty.
  initialTitle?: string;
  saving: boolean;
  // Persists the game and resolves to whether it succeeded, so the dialog can
  // close (normal) or reset for another entry (mass-input mode) accordingly.
  onCreate: (input: NewVideoGameInput) => Promise<boolean>;
  onClose: () => void;
};

export default function VideoGameCreateModal({
  definitions,
  systems,
  defaultSystemId,
  initialTitle = "",
  saving,
  onCreate,
  onClose,
}: VideoGameCreateModalProps) {
  // Mass-input mode turns the dialog into a rapid data-entry loop: the button
  // becomes "Create And Add Another", each save clears the form and refocuses
  // Title, and the dialog closes via the X or Escape (no backdrop or Cancel).
  const { settings } = useUiSettings();
  const massInputMode = settings.massInputMode;

  const defaultSystemName =
    systems.find((s) => s.id === defaultSystemId)?.name ?? "";

  // Option fields start on their configured default; everything else empty.
  // Shared by the initial state and the post-save reset.
  function makeInitialValues(): Record<number, string> {
    const initial: Record<number, string> = {};
    for (const def of definitions) initial[def.id] = defaultValue(def);
    return initial;
  }

  const [title, setTitle] = useState(initialTitle);
  const [systemName, setSystemName] = useState(defaultSystemName);
  const [values, setValues] = useState<Record<number, string>>(makeInitialValues);
  // Bumped after each mass-input save to drive the "refocus Title" effect.
  const [entryNonce, setEntryNonce] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleCellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Escape always closes the dialog, even in mass-input mode.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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

  const selectedSystem = systems.find((s) => s.name === systemName);
  const canCreate = title.trim().length > 0 && !!selectedSystem && !saving;

  // The System row borrows the dropdown editor, with the systems list as its
  // options (committed by name, mapped back to a systemId on submit).
  const systemOptions: CustomFieldOption[] = systems.map((s, i) => ({
    id: s.id,
    customFieldId: -1,
    name: s.name,
    isDefault: false,
    order: i,
  }));

  // Title + System first, then the custom fields in their defined order. Each
  // field's onCommit just writes into local state — persistence happens on
  // submit.
  const rows: Row[] = [
    {
      key: "title",
      name: "Title",
      kind: "text",
      value: title,
      standard: true,
      onCommit: setTitle,
    },
    {
      key: "system",
      name: "System",
      kind: "dropdown",
      value: systemName,
      options: systemOptions,
      standard: true,
      onCommit: setSystemName,
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
    if (!canCreate || !selectedSystem) return;
    // Sends each set field plus every boolean (an untouched boolean shows "No"
    // and is saved as "false"), in the shape the detail pages use.
    const customFieldValues: CustomFieldValue[] = buildCustomFieldValues(
      definitions,
      values,
    );
    const ok = await onCreate({
      title: title.trim(),
      systemId: selectedSystem.id,
      customFieldValues,
    });
    // Keep the form (and the user's input) on failure so they can retry.
    if (!ok) return;
    if (massInputMode) {
      // Clear the form for the next entry, but keep the chosen System — rapid
      // entry usually stays on one system, so re-picking it every time would be
      // tedious. The entryNonce effect refocuses Title.
      setTitle("");
      setValues(makeInitialValues());
      setEntryNonce((n) => n + 1);
    } else {
      onClose();
    }
  };

  // Portal to <body> so the fixed backdrop escapes the page content's stacking
  // context (video-games.module.css .content is z-index 0). Rendered inline, the
  // backdrop's z-index 60 is trapped below the Header's z-index-2 .content and
  // the hero logo/title would paint over the modal. document is always defined
  // here — the modal only mounts on a client-side open.
  return createPortal(
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
        aria-labelledby="video-game-create-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        <div className={styles.head}>
          <h2 id="video-game-create-title" className={styles.title}>
            Create Video Game
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
