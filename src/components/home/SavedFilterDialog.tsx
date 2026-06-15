"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EntityKey } from "@/lib/api";
import { PlusIcon, TrashIcon, XIcon } from "@/components/custom-fields/icons";
import EntitySelect from "@/components/custom-fields/EntitySelect";
import FilterChip from "@/components/filters/FilterChip";
import FilterEditor from "@/components/filters/FilterEditor";
import Listbox from "@/components/filters/Listbox";
import { newFilterId } from "@/components/filters/ids";
import type { ActiveFilter, FilterFieldDef } from "@/components/filters/types";
import { fetchEntityFilterFields } from "./entityFields";
import type { SavedFilter, SavedFilterCondition } from "./types";
import styles from "./SavedFilterDialog.module.css";

// Focusable elements inside the dialog, in tab order — recomputed each Tab so
// the trap follows the live UI (chips, the filter editor popping in). Mirrors
// the helper in the other dialogs.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// What the inline filter editor is doing: closed, adding a new condition, or
// editing an existing one (anchored to its chip). Same shape FilterBar uses.
type EditState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; filter: ActiveFilter };

// The entity a brand-new saved filter targets until the user picks another.
const DEFAULT_ENTITY: EntityKey = "videoGame";

// The new/edit saved-filter dialog: name the shortcut, choose the collection it
// applies to, and build its filter conditions with the same chip + editor the
// collection pages use. Doubles as the edit dialog — when `initial` is given the
// fields are prefilled and a Delete button (matching the rest of the app)
// appears. Fully controlled: it calls back with the assembled SavedFilter and
// never persists itself.
export default function SavedFilterDialog({
  initial,
  categories,
  initialCategoryId,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: SavedFilter;
  // The categories this filter can live in (id + name), in display order — the
  // "Category" picker's options. Includes the Uncategorized row.
  categories: { id: string; name: string }[];
  // The category the dialog opens on: the one whose "New filter" was clicked, or
  // the edited filter's current category.
  initialCategoryId: string;
  // Returns the assembled filter and the category it should live in (changing it
  // moves the filter between categories).
  onSave: (filter: SavedFilter, categoryId: string) => void;
  // Provided only in edit mode, to remove this saved filter.
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [entity, setEntity] = useState<EntityKey>(
    initial?.entity ?? DEFAULT_ENTITY,
  );
  const [conditions, setConditions] = useState<ActiveFilter[]>(
    initial?.conditions ?? [],
  );
  const [fields, setFields] = useState<FilterFieldDef[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [edit, setEdit] = useState<EditState>({ mode: "closed" });
  const [confirming, setConfirming] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Load the selected entity's filter field list. Re-runs when the entity
  // changes; a failed load just leaves the Add button disabled. The loading
  // flag starts true and is re-raised in changeEntity, so it isn't set
  // synchronously in this effect body.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchEntityFilterFields(entity, controller.signal)
      .then((loaded) => {
        if (!active) return;
        setFields(loaded);
        setLoadingFields(false);
      })
      .catch(() => {
        if (!active || controller.signal.aborted) return;
        setFields([]);
        setLoadingFields(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [entity]);

  // Focus the name field on open (text selected so it's ready to overwrite), and
  // return focus to whatever opened the dialog on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    nameRef.current?.focus();
    nameRef.current?.select();
    return () => opener?.focus?.();
  }, []);

  // Escape closes the delete-confirm first, then defers to the filter editor (it
  // closes itself), otherwise closes the dialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirming) {
        setConfirming(false);
        return;
      }
      if (edit.mode !== "closed") return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, confirming, edit.mode]);

  // Any click outside the confirm menu (and its trigger) dismisses it.
  useEffect(() => {
    if (!confirming) return;
    const close = () => setConfirming(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [confirming]);

  // Keep Tab / Shift+Tab inside the dialog.
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

  const sourceOf = (token: string): "standard" | "custom" =>
    fields.find((f) => f.field === token)?.source ?? "custom";

  // Switching entity invalidates conditions built against the old field list, so
  // clear them (and any open editor) when the user picks a different collection.
  const changeEntity = (key: EntityKey) => {
    if (key === entity) return;
    setEntity(key);
    setLoadingFields(true);
    setConditions([]);
    setEdit({ mode: "closed" });
  };

  const applyAdd = (filter: ActiveFilter) => {
    setConditions((prev) => [...prev, filter]);
    setEdit({ mode: "closed" });
  };
  const applyEdit = (filter: ActiveFilter) => {
    setConditions((prev) => prev.map((f) => (f.id === filter.id ? filter : f)));
    setEdit({ mode: "closed" });
  };
  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((f) => f.id !== id));
  };

  const trimmed = name.trim();
  const canSave = trimmed !== "" && conditions.length > 0;

  const save = () => {
    if (!canSave) return;
    // Snapshot each condition's field source so the card can color its glyph
    // without re-resolving the field list.
    const savedConditions: SavedFilterCondition[] = conditions.map((c) => ({
      ...c,
      source: sourceOf(c.field),
    }));
    onSave(
      {
        id: initial?.id ?? newFilterId(),
        name: trimmed,
        entity,
        conditions: savedConditions,
        count: initial?.count ?? null,
      },
      categoryId,
    );
    onClose();
  };

  return createPortal(
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-filter-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        <div className={styles.head}>
          <h2 id="saved-filter-title" className={styles.title}>
            {initial ? "Edit Filter" : "New Filter"}
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

        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            ref={nameRef}
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
          />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Applies to</span>
          <EntitySelect
            value={entity}
            onChange={changeEntity}
            ariaLabel="Applies to"
            className={styles.entity}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Category</span>
          <Listbox
            value={categoryId}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            onChange={setCategoryId}
            ariaLabel="Category"
            className={styles.category}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Filters</span>
          <div className={styles.filters}>
            {conditions.map((filter) => (
              <span className={styles.anchor} key={filter.id}>
                <FilterChip
                  filter={filter}
                  fieldSource={sourceOf(filter.field)}
                  onEdit={() => setEdit({ mode: "edit", filter })}
                  onRemove={() => removeCondition(filter.id)}
                />
                {edit.mode === "edit" && edit.filter.id === filter.id && (
                  <FilterEditor
                    fields={fields}
                    initial={edit.filter}
                    onApply={applyEdit}
                    onCancel={() => setEdit({ mode: "closed" })}
                  />
                )}
              </span>
            ))}
            <span className={styles.anchor}>
              <button
                type="button"
                className={styles.addBtn}
                disabled={loadingFields || fields.length === 0}
                aria-expanded={edit.mode === "add"}
                onClick={() =>
                  setEdit((e) =>
                    e.mode === "add" ? { mode: "closed" } : { mode: "add" },
                  )
                }
              >
                <PlusIcon /> Add filter
              </button>
              {edit.mode === "add" && (
                <FilterEditor
                  fields={fields}
                  onApply={applyAdd}
                  onCancel={() => setEdit({ mode: "closed" })}
                />
              )}
            </span>
          </div>
          {conditions.length === 0 && (
            <p className={styles.hint}>
              {loadingFields
                ? "Loading fields…"
                : "Add at least one filter to define this shortcut."}
            </p>
          )}
        </div>

        <div className={styles.foot}>
          {onDelete ? (
            <div className={styles.deleteWrap}>
              <button
                type="button"
                className={styles.del}
                aria-haspopup="menu"
                aria-expanded={confirming}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirming((c) => !c);
                }}
              >
                <TrashIcon /> Delete
              </button>
              {confirming && (
                <div
                  role="menu"
                  aria-label="Delete Filter?"
                  className={styles.confirm}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={styles.confirmText}>Are you sure?</span>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.confirmDelete}
                    onClick={() => {
                      onDelete();
                      onClose();
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ) : (
            <span />
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.save}
              disabled={!canSave}
              onClick={save}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
