"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@/components/custom-fields/icons";
import { useToast } from "@/components/ToastProvider";
import styles from "./DeleteEntityButton.module.css";

// The destructive action for a record's detail page: a red button pinned to the
// bottom-right that opens the same small "Are you sure?" confirmation the data
// tables use, then DELETEs the record and returns to its list. Lifting delete
// out of the table row and onto the detail page keeps it a deliberate, one-at-a
// -time action.
export default function DeleteEntityButton({
  endpoint,
  label,
  successMessage,
  errorNoun,
  backHref,
}: {
  // The DELETE URL for this record (e.g. `/api/toys/12`).
  endpoint: string;
  // Button text + the confirmation menu's aria-label (e.g. "Delete Toy").
  label: string;
  // Success toast on a confirmed delete (e.g. "Toy deleted.").
  successMessage: string;
  // Lowercase noun woven into the failure snackbar (e.g. "toy").
  errorNoun: string;
  // Where to go once the record is gone — the entity's list page.
  backHref: string;
}) {
  const router = useRouter();
  const { showToast, showSnackbar } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Any click elsewhere (the menu and its trigger stop propagation) or Escape
  // dismisses the confirmation menu — the same behavior as the table's trash.
  useEffect(() => {
    if (!confirming) return;
    const close = () => setConfirming(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [confirming]);

  // Delete the record, then leave for the list (which reloads fresh, so the
  // gone record never shows). On failure, stay put and surface the backend's
  // message — a record still referenced elsewhere surfaces its rejection here.
  const handleDelete = async () => {
    setConfirming(false);
    setDeleting(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "Request failed");
      }
      showToast({ message: successMessage, variant: "success" });
      router.push(backHref);
    } catch (error) {
      console.error(`Delete ${errorNoun} failed`, error);
      setDeleting(false);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't delete the ${errorNoun}: ${error.message}`
            : `Couldn't delete the ${errorNoun}. Please try again.`,
        variant: "error",
      });
    }
  };

  return (
    <div className={styles.footer}>
      {/* position:relative anchor for the confirmation menu. */}
      <div className={styles.wrap}>
        <button
          type="button"
          className={styles.del}
          aria-haspopup="menu"
          aria-expanded={confirming}
          disabled={deleting}
          onClick={(e) => {
            e.stopPropagation();
            setConfirming((c) => !c);
          }}
        >
          <TrashIcon /> {label}
        </button>
        {confirming && (
          <div
            role="menu"
            aria-label={`${label}?`}
            className={styles.confirm}
            onClick={(e) => e.stopPropagation()}
          >
            <span className={styles.confirmText}>Are you sure?</span>
            <button
              type="button"
              role="menuitem"
              className={styles.confirmDelete}
              onClick={() => void handleDelete()}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
