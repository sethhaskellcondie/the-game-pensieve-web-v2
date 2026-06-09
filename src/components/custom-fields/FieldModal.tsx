"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CustomField,
  CustomFieldType,
  EntityKey,
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
} from "@/lib/api";
import {
  ENTITY_META,
  ENTITY_ORDER,
  FIELD_TYPE_META,
  FIELD_TYPE_ORDER,
  hasOptions,
  KindGlyph,
} from "./registry";
import KindBadge from "./KindBadge";
import EntityBadge from "./EntityBadge";
import { CaretIcon, PlusIcon, XIcon } from "./icons";
import styles from "./FieldModal.module.css";

// What the modal hands back on save: a create input, or an edit input plus the
// id of the field being edited. The manager performs the actual request.
export type FieldModalSave =
  | { mode: "create"; input: CreateCustomFieldInput }
  | { mode: "edit"; id: number; input: UpdateCustomFieldInput };

type DraftOption = { id: number | null; name: string };

type FieldModalProps = {
  mode: "create" | "edit";
  field?: CustomField;
  defaultEntityKey: EntityKey;
  saving?: boolean;
  onSave: (payload: FieldModalSave) => void;
  onClose: () => void;
};

export default function FieldModal({
  mode,
  field,
  defaultEntityKey,
  saving = false,
  onSave,
  onClose,
}: FieldModalProps) {
  const isEdit = mode === "edit";
  const [name, setName] = useState(field?.name ?? "");
  const [type, setType] = useState<CustomFieldType>(field?.type ?? "text");
  const [entityKey, setEntityKey] = useState<EntityKey>(
    field?.entityKey ?? defaultEntityKey,
  );
  const [options, setOptions] = useState<DraftOption[]>(() =>
    field
      ? [...field.options]
          .sort((a, b) => a.order - b.order)
          .map((o) => ({ id: o.id, name: o.name }))
      : [],
  );
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // In edit mode the type is locked, so options visibility follows the existing
  // field's type; in create mode it follows the picked type.
  const effectiveType = isEdit && field ? field.type : type;
  const showsOptions = hasOptions(effectiveType);
  const trimmedOptionCount = options.filter(
    (o) => o.name.trim().length > 0,
  ).length;
  const canSave =
    name.trim().length > 0 && (!showsOptions || trimmedOptionCount > 0);

  const setOption = (index: number, value: string) =>
    setOptions((os) => os.map((o, i) => (i === index ? { ...o, name: value } : o)));
  const addOption = () =>
    setOptions((os) => [...os, { id: null, name: "" }]);
  const removeOption = (index: number) =>
    setOptions((os) => os.filter((_, i) => i !== index));

  const submit = () => {
    if (!canSave || saving) return;
    if (isEdit && field) {
      // Full-replacement options that preserve existing ids; keep the default on
      // the previously-default option if it survived, else fall back to first.
      const prevDefaultId = field.options.find((o) => o.isDefault)?.id ?? null;
      const kept = options
        .map((o) => ({ id: o.id, name: o.name.trim() }))
        .filter((o) => o.name.length > 0);
      const defaultPresent = kept.some(
        (o) => o.id != null && o.id === prevDefaultId,
      );
      const input: UpdateCustomFieldInput = {
        name: name.trim(),
        order: field.order,
        ...(hasOptions(field.type)
          ? {
              options: kept.map((o, i) => ({
                id: o.id,
                name: o.name,
                order: i,
                isDefault: defaultPresent ? o.id === prevDefaultId : i === 0,
              })),
            }
          : {}),
      };
      onSave({ mode: "edit", id: field.id, input });
      return;
    }
    const trimmed = options
      .map((o) => o.name.trim())
      .filter((n) => n.length > 0);
    const input: CreateCustomFieldInput = {
      name: name.trim(),
      type,
      entityKey,
      ...(hasOptions(type)
        ? {
            options: trimmed.map((n, i) => ({
              name: n,
              order: i,
              isDefault: i === 0,
            })),
          }
        : {}),
    };
    onSave({ mode: "create", input });
  };

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cf-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <h2 id="cf-modal-title" className={styles.title}>
            {isEdit ? "Edit custom field" : "New custom field"}
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

        <label className={styles.label} htmlFor="cf-field-name">
          Field name
        </label>
        <input
          id="cf-field-name"
          ref={nameRef}
          className={styles.input}
          value={name}
          placeholder="e.g. Designer, Play Time, Acquired Date"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />

        <span className={styles.label}>Field type</span>
        {isEdit && field ? (
          <div className={styles.readRow}>
            <KindBadge type={field.type} />
            <span className={styles.readNote}>Type can&apos;t be changed</span>
          </div>
        ) : (
          <div
            className={styles.kindGrid}
            role="radiogroup"
            aria-label="Field type"
          >
            {FIELD_TYPE_ORDER.map((key) => {
              const meta = FIELD_TYPE_META[key];
              const active = type === key;
              return (
                <button
                  type="button"
                  key={key}
                  role="radio"
                  aria-checked={active}
                  className={`${styles.kindOpt}${active ? ` ${styles.kindOptOn}` : ""}`}
                  style={active ? { borderColor: meta.fg } : undefined}
                  onClick={() => setType(key)}
                >
                  <span
                    className={styles.kindOptGlyph}
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    <KindGlyph type={key} size={18} />
                  </span>
                  <span className={styles.kindOptLabel}>{meta.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <span className={styles.label}>Applies to</span>
        {isEdit && field ? (
          <div className={styles.readRow}>
            <EntityBadge entityKey={field.entityKey} />
            <span className={styles.readNote}>Can&apos;t be reassigned</span>
          </div>
        ) : (
          <div className={styles.selectWrap}>
            <select
              aria-label="Applies to"
              value={entityKey}
              onChange={(e) => setEntityKey(e.target.value as EntityKey)}
            >
              {ENTITY_ORDER.map((key) => (
                <option key={key} value={key}>
                  {ENTITY_META[key].label}
                </option>
              ))}
            </select>
            <CaretIcon />
          </div>
        )}

        {showsOptions && (
          <>
            <span className={styles.label}>Options</span>
            <div className={styles.optEdit}>
              {options.length === 0 && (
                <div className={styles.optEmpty}>
                  No options yet — add the choices users can pick from.
                </div>
              )}
              {options.map((opt, i) => (
                <div className={styles.optRow} key={i}>
                  <span className={styles.optIdx}>{i + 1}</span>
                  <input
                    className={styles.optInput}
                    aria-label={`Option ${i + 1}`}
                    value={opt.name}
                    placeholder="Option label"
                    autoFocus={opt.name === "" && i === options.length - 1}
                    onChange={(e) => setOption(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={styles.optDel}
                    aria-label={`Remove option ${i + 1}`}
                    onClick={() => removeOption(i)}
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
              <button type="button" className={styles.optAdd} onClick={addOption}>
                <PlusIcon /> Add option
              </button>
            </div>
          </>
        )}

        <div className={styles.foot}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.save}
            disabled={!canSave || saving}
            onClick={submit}
          >
            {saving
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Create field"}
          </button>
        </div>
      </div>
    </div>
  );
}
