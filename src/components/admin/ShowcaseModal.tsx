"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/custom-fields/icons";
import type { AdminUser } from "@/lib/api";
import styles from "./ShowcaseModal.module.css";

// The backend's slug rule (SetShowcaseRequest): lowercase alphanumerics with
// single interior hyphens. Checked client-side for instant feedback; the
// backend remains the authority (its 400 messages are surfaced verbatim).
const SLUG_RE = /^[a-z0-9](-?[a-z0-9])*$/;
const SLUG_MAX = 63;

async function readMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? "";
  } catch {
    return "";
  }
}

// Admin dialog for granting/editing/revoking a user's public showcase.
// Saving posts { slug, name } to the BFF (blank slug clears the grant) and
// hands the updated account back to the manager.
export default function ShowcaseModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: (updated: AdminUser) => void;
}) {
  const [slug, setSlug] = useState(user.showcaseSlug ?? "");
  const [name, setName] = useState(user.showcaseName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const trimmedSlug = slug.trim();
  const slugInvalid =
    trimmedSlug !== "" &&
    (!SLUG_RE.test(trimmedSlug) || trimmedSlug.length > SLUG_MAX);
  const clearing = trimmedSlug === "";
  // A granted slug is only publicly listed while its owner derives to
  // PAID/ADMIN — a real, confusing state worth calling out to the admin.
  const wouldBeDark =
    !clearing && user.role !== "PAID" && user.role !== "ADMIN";

  const submit = async (payload: {
    slug: string | null;
    name: string | null;
  }) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/showcase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(
          (await readMessage(res)) || "Couldn't update the showcase.",
        );
        return;
      }
      const body = (await res.json()) as { data?: AdminUser };
      if (body.data) onSaved(body.data);
      onClose();
    } catch {
      setError("Couldn't update the showcase.");
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (slugInvalid) return;
    void submit({
      slug: clearing ? null : trimmedSlug,
      name: clearing ? null : name.trim() || null,
    });
  };

  return createPortal(
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="showcase-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <h2 id="showcase-modal-title" className={styles.title}>
            Public showcase
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
          Publish <strong>{user.email}</strong>&rsquo;s collection as a public
          showcase. Leave the slug blank (or use Clear) to unpublish.
        </p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="showcase-name">
            Display name
          </label>
          <input
            id="showcase-name"
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Retro Vault"
            disabled={saving}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="showcase-slug">
            Slug
          </label>
          <input
            id="showcase-slug"
            className={styles.input}
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. retro-vault"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={slugInvalid || undefined}
            disabled={saving}
          />
          <p className={styles.fieldHint}>
            Lowercase letters, digits, and single hyphens (e.g.{" "}
            <code>retro-vault</code>). This becomes the showcase&rsquo;s public
            address.
          </p>
          {slugInvalid ? (
            <p className={styles.error} role="alert">
              Slugs are lowercase letters and digits separated by single
              hyphens, up to {SLUG_MAX} characters.
            </p>
          ) : null}
        </div>

        {wouldBeDark ? (
          <p className={styles.warn} role="note">
            Slug reserved but not publicly visible — the owner&rsquo;s role is{" "}
            {user.role}. The showcase appears in the directory only while the
            owner is PAID or ADMIN.
          </p>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.foot}>
          {user.showcaseSlug ? (
            <button
              type="button"
              className={styles.clear}
              disabled={saving}
              onClick={() => void submit({ slug: null, name: null })}
            >
              Clear showcase
            </button>
          ) : null}
          <button
            type="button"
            className={styles.cancel}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.save}
            disabled={saving || slugInvalid || (clearing && !user.showcaseSlug)}
            onClick={save}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
