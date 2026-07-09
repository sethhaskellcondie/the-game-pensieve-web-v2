"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TrashIcon, XIcon } from "@/components/custom-fields/icons";
import type { FilterCategory } from "./types";
import { useMobileShelf } from "@/lib/useMobileShelf";
import styles from "./CategoryEditDialog.module.css";

// Focusable elements inside the dialog, in tab order — recomputed each Tab so
// the trap follows the live UI (e.g. the delete-confirm popping in). Mirrors the
// helper in ToyCreateModal so the dialogs trap focus the same way.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// The "Edit Category" dialog: rename the category, or delete it via the same
// red button + "Are you sure?" confirmation the rest of the app uses. Fully
// controlled — it calls back to rename/delete and never touches the backend
// itself (persistence is wired at the dashboard).
export default function CategoryEditDialog({
  category,
  onRename,
  onDelete,
  onClose,
}: {
  category: FilterCategory;
  onRename: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [confirming, setConfirming] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // On mobile the dialog behaves as a shelf: slides in from the right, sits
  // below the header, slides back off to the right on close. requestClose plays that
  // exit before onClose unmounts; on desktop it closes immediately.
  const { requestClose, overlayStyle, slideStyle } = useMobileShelf();

  // Focus the name field on open (text selected so it's ready to overwrite), and
  // return focus to whatever opened the dialog (the edit pencil) on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => opener?.focus?.();
  }, []);

  // Escape closes the delete-confirm first if it's open, otherwise the dialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirming) setConfirming(false);
      else requestClose(onClose);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, confirming, requestClose]);

  // Any click outside the confirm menu (and its trigger, which stops
  // propagation) dismisses it — same behavior as the detail page's delete.
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

  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  const save = () => {
    if (!canSave) return;
    onRename(trimmed);
    requestClose(onClose);
  };

  return createPortal(
    <div
      className={styles.backdrop}
      style={overlayStyle}
      onMouseDown={() => requestClose(onClose)}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        style={slideStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-edit-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        <div className={styles.head}>
          <h2 id="category-edit-title" className={styles.title}>
            Edit Category
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

        <label className={styles.field}>
          <span className={styles.label}>Category name</span>
          <input
            ref={inputRef}
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

        <div className={styles.foot}>
          {/* position:relative anchor for the confirmation menu. */}
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
                aria-label="Delete Category?"
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
                    requestClose(onClose);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          <div className={styles.actions}>
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
