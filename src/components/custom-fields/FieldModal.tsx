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
import { CaretIcon, GripIcon, PlusIcon, XIcon } from "./icons";
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
  // Index into `options` of the option marked default. Only one can be default,
  // so a single index is enough; removeOption keeps it pointed at a live row.
  const [defaultIndex, setDefaultIndex] = useState<number>(() => {
    if (!field) return 0;
    const idx = [...field.options]
      .sort((a, b) => a.order - b.order)
      .findIndex((o) => o.isDefault);
    return idx >= 0 ? idx : 0;
  });
  // Drag-to-reorder state for the options editor, mirroring the field table:
  // dragIndex is the row being dragged, overInfo marks the hovered drop target
  // and which edge (before/after) the cursor is closest to.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overInfo, setOverInfo] = useState<{
    index: number;
    pos: "before" | "after";
  } | null>(null);
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
  const removeOption = (index: number) => {
    setOptions((os) => os.filter((_, i) => i !== index));
    // Keep the default pointed at the same option: if we removed the default
    // itself, fall back to the first; if we removed one above it, shift down.
    setDefaultIndex((d) => {
      if (index === d) return 0;
      return index < d ? d - 1 : d;
    });
  };
  const resetDrag = () => {
    setDragIndex(null);
    setOverInfo(null);
  };
  // Reorder via drag: drop the dragged row before/after the target. The same
  // index permutation is applied to both the options array and the default
  // marker so the chosen default stays attached to its option.
  const dropOption = (targetIndex: number) => {
    const from = dragIndex;
    if (from == null || from === targetIndex) {
      resetDrag();
      return;
    }
    const pos = overInfo?.index === targetIndex ? overInfo.pos : "before";
    const order = options.map((_, i) => i);
    const [moved] = order.splice(from, 1);
    let to = targetIndex > from ? targetIndex - 1 : targetIndex;
    if (pos === "after") to += 1;
    order.splice(to, 0, moved);
    setOptions((os) => order.map((i) => os[i]));
    setDefaultIndex((d) => order.indexOf(d));
    resetDrag();
  };

  const submit = () => {
    if (!canSave || saving) return;
    // Drop blank rows, but remember which surviving row the user marked default.
    // If that row was blank (and thus dropped), fall back to the first option.
    const kept = options
      .map((o, i) => ({ id: o.id, name: o.name.trim(), wasDefault: i === defaultIndex }))
      .filter((o) => o.name.length > 0);
    const defaultPos = kept.findIndex((o) => o.wasDefault);
    const withDefault = kept.map((o, i) => ({
      name: o.name,
      order: i,
      isDefault: defaultPos >= 0 ? i === defaultPos : i === 0,
    }));

    if (isEdit && field) {
      const input: UpdateCustomFieldInput = {
        name: name.trim(),
        order: field.order,
        // Full-replacement options that preserve existing ids.
        ...(hasOptions(field.type)
          ? {
              options: kept.map((o, i) => ({
                id: o.id,
                ...withDefault[i],
              })),
            }
          : {}),
      };
      onSave({ mode: "edit", id: field.id, input });
      return;
    }
    const input: CreateCustomFieldInput = {
      name: name.trim(),
      type,
      entityKey,
      ...(hasOptions(type) ? { options: withDefault } : {}),
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
            {isEdit ? "Update Custom Field" : "Create Custom Field"}
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
          placeholder="Designer, Play Time, Acquired Date, etc."
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />

        {!isEdit && (
          <>
            <span className={styles.label}>Applies to</span>
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

            <span className={styles.label}>Field type</span>
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
          </>
        )}

        {showsOptions && (
          <>
            <span className={styles.label}>Options</span>
            <div className={styles.optEdit}>
              {options.length === 0 && (
                <div className={styles.optEmpty}>
                  Add at least one option.
                </div>
              )}
              {options.length > 0 && (
                <div className={styles.optHint}>
                  Drag the handles to reorder. Use the radio buttons to select a
                  default option.
                </div>
              )}
              {options.map((opt, i) => {
                const isOver =
                  overInfo?.index === i &&
                  dragIndex != null &&
                  dragIndex !== i;
                const dropCls = isOver
                  ? overInfo.pos === "before"
                    ? ` ${styles.dropBefore}`
                    : ` ${styles.dropAfter}`
                  : "";
                return (
                  <div
                    className={`${styles.optRow}${dragIndex === i ? ` ${styles.optDragging}` : ""}${dropCls}`}
                    key={i}
                    onDragOver={(e) => {
                      if (dragIndex == null) return;
                      e.preventDefault();
                      const rc = e.currentTarget.getBoundingClientRect();
                      setOverInfo({
                        index: i,
                        pos:
                          e.clientY - rc.top < rc.height / 2
                            ? "before"
                            : "after",
                      });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      dropOption(i);
                    }}
                  >
                    <span
                      className={styles.optGrip}
                      aria-label={`Reorder option ${i + 1}`}
                      draggable
                      onDragStart={(e) => {
                        setDragIndex(i);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(i));
                        const row = e.currentTarget.parentElement;
                        if (row) e.dataTransfer.setDragImage(row, 24, 18);
                      }}
                      onDragEnd={resetDrag}
                    >
                      <GripIcon />
                    </span>
                    <input
                      type="radio"
                      className={styles.optDefault}
                      name="cf-default-option"
                      checked={i === defaultIndex}
                      aria-label={`Make option ${i + 1} the default`}
                      title="Make default"
                      onChange={() => setDefaultIndex(i)}
                    />
                    <div className={styles.optInputWrap}>
                      <input
                        className={`${styles.optInput}${i === defaultIndex ? ` ${styles.optInputDefault}` : ""}`}
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
                      {i === defaultIndex && (
                        <span className={styles.optDefaultTag} aria-hidden="true">
                          (default)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={styles.optDel}
                      aria-label={`Remove option ${i + 1}`}
                      onClick={() => removeOption(i)}
                    >
                      <XIcon />
                    </button>
                  </div>
                );
              })}
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
