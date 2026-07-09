"use client";

import { useEffect, useRef } from "react";
import Button from "@/components/Button";
import styles from "./UpgradePrompt.module.css";

// Shown when the backend reports the account has lapsed (402 on a filter, 403 on
// a write). Explains why the action was blocked and points to the pricing page.
// Rendered by SessionProvider; payment integration is stubbed for now.
export default function UpgradePrompt({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      data-testid="upgrade-backdrop"
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-prompt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="upgrade-prompt-title" className={styles.title}>
          Subscription required
        </h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button
            ref={closeRef}
            type="button"
            className={styles.dismiss}
            onClick={onClose}
          >
            Not now
          </button>
          <Button href="/pricing" onClick={onClose}>
            View plans
          </Button>
        </div>
      </div>
    </div>
  );
}
