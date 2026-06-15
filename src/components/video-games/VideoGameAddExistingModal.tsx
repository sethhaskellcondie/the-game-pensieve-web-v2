"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { VideoGame } from "@/lib/api";
import { XIcon } from "@/components/custom-fields/icons";
import { searchVideoGamesClient } from "./searchClient";
import styles from "@/components/toys/ToyCreateModal.module.css";
import gameStyles from "./VideoGameBoxCreateModal.module.css";

// Attach-an-existing-video-game dialog for the box detail page. The standard
// create-modal chrome (ToyCreateModal.module.css) wrapped around the same
// existing-game picker the create-box dialog uses (VideoGameBoxCreateModal.module.css):
// the full game list is fetched once on first focus and filtered client-side.
// Picking a result persists immediately through onAdd; the dialog stays open so
// several games can be added in a row, and the just-added game drops out of the
// results as excludeIds grows.

// The picker only renders this many matches; narrower queries find the rest.
const PICKER_CAP = 25;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

type VideoGameAddExistingModalProps = {
  // Games already in this box, hidden from the results (a box can't list the
  // same game twice).
  excludeIds: number[];
  saving: boolean;
  // Attaches the picked game to the box and resolves to whether it succeeded.
  onAdd: (game: VideoGame) => Promise<boolean>;
  onClose: () => void;
};

export default function VideoGameAddExistingModal({
  excludeIds,
  saving,
  onAdd,
  onClose,
}: VideoGameAddExistingModalProps) {
  // The full game list is fetched once on first focus and filtered client-side.
  const [query, setQuery] = useState("");
  const [allGames, setAllGames] = useState<VideoGame[] | null>(null);
  const [loadingGames, setLoadingGames] = useState(false);
  const [gamesError, setGamesError] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Escape closes the dialog (no mass-input loop to keep it open here).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Move focus into the dialog on open, and return it to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    getFocusable(modalRef.current)[0]?.focus();
    return () => opener?.focus?.();
  }, []);

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

  // Fetch the full game list once, on the picker's first focus.
  const loadGames = () => {
    if (allGames !== null || loadingGames) return;
    setLoadingGames(true);
    setGamesError(false);
    searchVideoGamesClient([])
      .then(setAllGames)
      .catch((error) => {
        console.error("Load video games failed", error);
        setGamesError(true);
      })
      .finally(() => setLoadingGames(false));
  };

  const excluded = new Set(excludeIds);
  const normalized = query.trim().toLowerCase();
  // Games already in this box are hidden; games shelved in another box stay
  // pickable (multi-box membership is legal) but get an "in <box>" label.
  const matches =
    normalized === "" || allGames === null
      ? []
      : allGames.filter(
          (g) =>
            g.title.toLowerCase().includes(normalized) && !excluded.has(g.id),
        );

  const add = async (game: VideoGame) => {
    if (saving) return;
    const ok = await onAdd(game);
    // On success the game leaves the results (excludeIds grew); clear the query
    // so the picker is ready for the next search.
    if (ok) setQuery("");
  };

  // Portal to <body> so the fixed backdrop escapes the page's stacking context,
  // matching the other video-game dialogs.
  return createPortal(
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-game-add-existing-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        <div className={styles.head}>
          <h2 id="video-game-add-existing-title" className={styles.title}>
            Add Existing Video Game
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

        <div className={gameStyles.picker}>
          <input
            type="search"
            className={gameStyles.pickerInput}
            placeholder="Search for a video game..."
            aria-label="Add an existing video game"
            value={query}
            onFocus={loadGames}
            onChange={(e) => setQuery(e.target.value)}
          />
          {gamesError && (
            <div className={gameStyles.pickerNote}>
              Couldn&apos;t load the game list. Try again later.
            </div>
          )}
          {!gamesError && normalized !== "" && loadingGames && (
            <div className={gameStyles.pickerNote}>Loading games…</div>
          )}
          {!gamesError && normalized !== "" && allGames !== null && (
            <ul aria-label="Matching games" className={gameStyles.results}>
              {matches.length === 0 ? (
                <li className={gameStyles.pickerNote}>No matches.</li>
              ) : (
                <>
                  {matches.slice(0, PICKER_CAP).map((game) => (
                    <li key={game.id}>
                      <button
                        type="button"
                        className={gameStyles.result}
                        disabled={saving}
                        onClick={() => add(game)}
                      >
                        <span className={gameStyles.resultTitle}>
                          {game.title}
                        </span>
                        {game.system && (
                          <span className={gameStyles.itemSystem}>
                            {game.system.name}
                          </span>
                        )}
                        {(game.videoGameBoxes?.length ?? 0) > 0 && (
                          <span className={gameStyles.resultBox}>
                            in {game.videoGameBoxes[0].title}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                  {matches.length > PICKER_CAP && (
                    <li className={gameStyles.pickerNote}>
                      {matches.length - PICKER_CAP} more — keep typing to narrow
                      it down.
                    </li>
                  )}
                </>
              )}
            </ul>
          )}
        </div>

        <div className={styles.foot}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
