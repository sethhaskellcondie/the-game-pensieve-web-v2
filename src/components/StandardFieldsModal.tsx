"use client";

import { useEffect, useState } from "react";
import BooleanBadge from "./BooleanBadge";
import { ENTITY_META, ENTITY_ORDER } from "./custom-fields/registry";
import { XIcon } from "./custom-fields/icons";
import { useUiSettings } from "./UiSettingsProvider";
import type { StandardFieldVisibility } from "@/lib/uiSettings.types";
import styles from "./StandardFieldsModal.module.css";

// The optional standard columns per entity, labeled to match the column
// headers the display grids render. The title/name column is always shown,
// so it is not listed.
const FIELD_LABELS: {
  [E in keyof StandardFieldVisibility]: {
    key: keyof StandardFieldVisibility[E] & string;
    label: string;
  }[];
} = {
  toy: [{ key: "set", label: "Set" }],
  system: [
    { key: "generation", label: "Generation" },
    { key: "handheld", label: "Handheld" },
  ],
  boardGame: [{ key: "boxes", label: "Boxes" }],
  boardGameBox: [
    { key: "boardGame", label: "Board Game" },
    { key: "expansion", label: "Expansion" },
    { key: "standAlone", label: "Stand Alone" },
    { key: "baseSet", label: "Base Set" },
  ],
  videoGame: [
    { key: "system", label: "System" },
    { key: "boxes", label: "Boxes" },
  ],
  videoGameBox: [
    { key: "system", label: "System" },
    { key: "games", label: "Games" },
    { key: "physical", label: "Physical" },
    { key: "collection", label: "Collection" },
  ],
};

type StandardFieldsModalProps = {
  onClose: () => void;
};

export default function StandardFieldsModal({
  onClose,
}: StandardFieldsModalProps) {
  const { settings, setSetting, saving } = useUiSettings();
  // Edits are staged locally and only persisted when the user saves, so
  // Cancel/Escape discards them without touching the stored settings.
  const [draft, setDraft] = useState<StandardFieldVisibility>(
    settings.standardFields,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const setField = (
    entity: keyof StandardFieldVisibility,
    key: string,
    next: boolean,
  ) => {
    if (saving) return;
    setDraft((d) => ({ ...d, [entity]: { ...d[entity], [key]: next } }));
  };

  const submit = async () => {
    if (saving) return;
    setFailed(false);
    const ok = await setSetting("standardFields", draft);
    if (ok) onClose();
    else setFailed(true);
  };

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="standard-fields-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <h2 id="standard-fields-title" className={styles.title}>
            Show/Hide Standard Fields
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

        <p className={styles.hint}>
          Yes to show the field or No to hide it. The title/name is always shown.
        </p>

        <div className={styles.groups}>
          {ENTITY_ORDER.map((entity) => (
            <section
              key={entity}
              className={styles.group}
              aria-label={ENTITY_META[entity].label}
            >
              <h3 className={styles.groupTitle}>{ENTITY_META[entity].label}</h3>
              {FIELD_LABELS[entity].map((field) => {
                const checked = (draft[entity] as Record<string, boolean>)[
                  field.key
                ];
                return (
                  <div key={field.key} className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{field.label}</span>
                    <BooleanBadge
                      value={checked}
                      label={`${ENTITY_META[entity].label}: ${field.label}`}
                      onToggle={() => setField(entity, field.key, !checked)}
                    />
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        {failed && (
          <p className={styles.error} role="alert">
            Couldn&apos;t save the field settings. Please try again.
          </p>
        )}

        <div className={styles.foot}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.save}
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? "Saving…" : "Save Fields"}
          </button>
        </div>
      </div>
    </div>
  );
}
