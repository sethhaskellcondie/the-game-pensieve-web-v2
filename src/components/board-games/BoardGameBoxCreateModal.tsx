"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  toCustomFieldValue,
  type BoardGameBox,
  type CreateBoardGameBoxInput,
  type CustomField,
  type CustomFieldType,
  type CustomFieldOption,
  type CustomFieldValue,
  type NewBoardGameInput,
} from "@/lib/api";
import {
  FIELD_TYPE_META,
  KindGlyph,
  STANDARD_FIELD_META,
  StandardFieldGlyph,
} from "@/components/custom-fields/registry";
import { PlusIcon, XIcon } from "@/components/custom-fields/icons";
import { useUiSettings } from "@/components/UiSettingsProvider";
import BeginnerHint from "@/components/BeginnerHint";
import { BEGINNER_HINTS } from "@/components/beginnerHints";
import FieldEditor from "@/components/toys/toyFieldEditors";
import BoardGameCreateModal from "./BoardGameCreateModal";
import {
  searchBoardGameBoxesClient,
  searchBoardGamesClient,
} from "./searchClient";
import rowStyles from "@/components/toys/ToyDetail.module.css";
import styles from "@/components/toys/ToyCreateModal.module.css";
import gameStyles from "@/components/video-games/VideoGameBoxCreateModal.module.css";

// Create-a-board-game-box dialog. The standard create-modal chrome (same
// stylesheet and focus/mass-input behaviors as ToyCreateModal), plus the two
// relationships a box carries:
// - Exactly one board game (the inverse of video game boxes' many games): an
//   existing game picked from the backend's list (POSTed as boardGameId) or a
//   brand-new one entered through a stacked BoardGameCreateModal (POSTed
//   inline as boardGame).
// - Optionally, for expansions, a base set box (POSTed as baseSetId). Picking
//   a base set defaults the linked game to the base set's game — an expansion
//   usually belongs to its base set's game — but a deliberate pick or clear of
//   the game always wins.

type Row = {
  key: string;
  name: string;
  kind: CustomFieldType;
  value: string;
  options?: CustomFieldOption[];
  standard?: boolean;
  onCommit: (value: string) => void;
};

// The box's one game: an existing game (only id + title matter here) or a new
// one queued for inline creation.
type SelectedGame =
  | { kind: "existing"; id: number; title: string }
  | { kind: "new"; input: NewBoardGameInput };

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

// The picker only renders this many matches; narrower queries find the rest.
const PICKER_CAP = 25;

type BoardGameBoxCreateModalProps = {
  // The boardGameBox entity's custom fields (the form's rows).
  definitions: CustomField[];
  // The boardGame entity's custom fields, for the stacked create-game dialog.
  gameDefinitions: CustomField[];
  saving: boolean;
  // When set (the board game detail page), the box is created for this game:
  // the game section shows it fixed and the POST always carries its id.
  lockedGame?: { id: number; title: string };
  // Persists the box and resolves to whether it succeeded, so the dialog can
  // close (normal) or reset for another entry (mass-input mode) accordingly.
  onCreate: (input: CreateBoardGameBoxInput) => Promise<boolean>;
  onClose: () => void;
};

export default function BoardGameBoxCreateModal({
  definitions,
  gameDefinitions,
  saving,
  lockedGame,
  onCreate,
  onClose,
}: BoardGameBoxCreateModalProps) {
  // Mass-input mode turns the dialog into a rapid data-entry loop: the button
  // becomes "Create And Add Another", each save clears the form and refocuses
  // Title, and the dialog only closes via the X (no Escape, backdrop, or Cancel).
  const { settings } = useUiSettings();
  const massInputMode = settings.massInputMode;

  // Option fields start on their configured default; everything else empty.
  // Shared by the initial state and the post-save reset.
  function makeInitialValues(): Record<number, string> {
    const initial: Record<number, string> = {};
    for (const def of definitions) initial[def.id] = defaultValue(def);
    return initial;
  }

  const [title, setTitle] = useState("");
  // A non-expansion box is playable on its own, so Stand Alone starts true.
  const [expansion, setExpansion] = useState("false");
  const [standAlone, setStandAlone] = useState("true");
  const [values, setValues] = useState<Record<number, string>>(makeInitialValues);
  // The box's one game, plus whether the stacked create-game dialog is open.
  const [selected, setSelected] = useState<SelectedGame | null>(null);
  const [addingGame, setAddingGame] = useState(false);
  // Whether the user has deliberately picked or cleared the game. While false,
  // picking a base set may auto-default the game; a touched choice is never
  // overridden. (Only ever read in event handlers.)
  const [gameTouched, setGameTouched] = useState(false);
  // Existing-game picker: the full game list is fetched once on first focus
  // and filtered client-side.
  const [pickerQuery, setPickerQuery] = useState("");
  const [allGames, setAllGames] = useState<
    Awaited<ReturnType<typeof searchBoardGamesClient>> | null
  >(null);
  const [loadingGames, setLoadingGames] = useState(false);
  const [gamesError, setGamesError] = useState(false);
  // Base-set picker (rendered only while Expansion is on): same
  // fetch-once-then-filter pattern over the box list.
  const [baseSet, setBaseSet] = useState<BoardGameBox | null>(null);
  const [baseQuery, setBaseQuery] = useState("");
  const [allBoxes, setAllBoxes] = useState<BoardGameBox[] | null>(null);
  const [loadingBoxes, setLoadingBoxes] = useState(false);
  const [boxesError, setBoxesError] = useState(false);
  // Bumped after each mass-input save to drive the "refocus Title" effect.
  const [entryNonce, setEntryNonce] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleCellRef = useRef<HTMLDivElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  // Set when a game is created through the stacked dialog, so focus lands on
  // this dialog's Create button once that dialog closes (see effect below). A
  // ref, not state — it only steers a focus side effect, never a render.
  const focusCreateAfterGameRef = useRef(false);

  useEffect(() => {
    // In mass-input mode the dialog only exits via a deliberate click (X or
    // Cancel), so the accidental-prone Escape shortcut is inert. While the
    // stacked create-game dialog is open, this listener detaches so Escape
    // closes only the child (its own listener handles it).
    if (massInputMode || addingGame) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, massInputMode, addingGame]);

  // After a mass-input save, focus the (now blank) Title field — focusing its
  // editor opens it ready to type. Skipped on first mount, which focuses the X.
  useEffect(() => {
    if (entryNonce === 0) return;
    titleCellRef.current
      ?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ?.focus();
  }, [entryNonce]);

  // Once the stacked create-game dialog closes after a successful create, move
  // focus to this dialog's Create button. The child restores focus to its
  // opener (the now-replaced Add New Game button) on unmount; this runs after
  // that and wins, leaving the user one keystroke from submitting the box. The
  // game is now selected, so Create is enabled (and focusable) as long as the
  // title is set.
  useEffect(() => {
    if (addingGame || !focusCreateAfterGameRef.current) return;
    focusCreateAfterGameRef.current = false;
    createButtonRef.current?.focus();
  }, [addingGame]);

  // Move focus into the dialog on open, landing on the Title field so a keyboard
  // user can start typing immediately (focusing its editor opens it). Falls back
  // to the first focusable, and returns focus to whatever opened the dialog (the
  // New button) when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const titleEditor =
      titleCellRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (titleEditor ?? getFocusable(modalRef.current)[0])?.focus();
    return () => opener?.focus?.();
  }, []);

  // Keep Tab / Shift+Tab inside the dialog: wrapping past the last focusable
  // returns to the first, and vice versa. Focus that has slipped outside (e.g.
  // after a control unmounts) is pulled back to the appropriate edge. The
  // stacked create-game dialog is a DOM sibling (not a child of modalRef), so
  // its keystrokes never reach this handler and the two traps don't fight.
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

  const isExpansion = expansion === "true";
  // A box holds exactly one game, so Create stays disabled until one is chosen
  // (or fixed by the caller).
  const canCreate =
    title.trim().length > 0 && (!!lockedGame || selected !== null) && !saving;

  // Unchecking Expansion makes the base set meaningless, so it's cleared — and
  // a game that was only auto-defaulted from it goes too.
  const commitExpansion = (v: string) => {
    setExpansion(v);
    if (v !== "true") {
      setBaseSet(null);
      setBaseQuery("");
      if (!gameTouched && !lockedGame) setSelected(null);
    }
  };

  // Title + Expansion + Stand Alone first, then the custom fields in their
  // defined order. Each field's onCommit just writes into local state —
  // persistence happens on submit.
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
      key: "expansion",
      name: "Expansion",
      kind: "boolean",
      value: expansion,
      standard: true,
      onCommit: commitExpansion,
    },
    {
      key: "standAlone",
      name: "Stand Alone",
      kind: "boolean",
      value: standAlone,
      standard: true,
      onCommit: setStandAlone,
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

  // Fetch the full game list once, on the picker's first focus.
  const loadGames = () => {
    if (allGames !== null || loadingGames) return;
    setLoadingGames(true);
    setGamesError(false);
    searchBoardGamesClient([])
      .then(setAllGames)
      .catch((error) => {
        console.error("Load board games failed", error);
        setGamesError(true);
      })
      .finally(() => setLoadingGames(false));
  };

  // Fetch the full box list once, on the base-set picker's first focus.
  const loadBoxes = () => {
    if (allBoxes !== null || loadingBoxes) return;
    setLoadingBoxes(true);
    setBoxesError(false);
    searchBoardGameBoxesClient([])
      .then(setAllBoxes)
      .catch((error) => {
        console.error("Load board game boxes failed", error);
        setBoxesError(true);
      })
      .finally(() => setLoadingBoxes(false));
  };

  const query = pickerQuery.trim().toLowerCase();
  const gameMatches =
    query === "" || allGames === null
      ? []
      : allGames.filter(
          (g) =>
            g.title.toLowerCase().includes(query) &&
            !(selected?.kind === "existing" && selected.id === g.id),
        );

  const baseSearch = baseQuery.trim().toLowerCase();
  const boxMatches =
    baseSearch === "" || allBoxes === null
      ? []
      : allBoxes.filter(
          (b) =>
            b.title.toLowerCase().includes(baseSearch) && b.id !== baseSet?.id,
        );

  const pickExisting = (game: { id: number; title: string }) => {
    setGameTouched(true);
    setSelected({ kind: "existing", id: game.id, title: game.title });
    setPickerQuery("");
  };

  const clearGame = () => {
    setGameTouched(true);
    setSelected(null);
  };

  // Picking a base set fills the game with the base set's game unless the user
  // already made a deliberate choice — Cities & Knights belongs to Catan.
  const pickBaseSet = (box: BoardGameBox) => {
    setBaseSet(box);
    setBaseQuery("");
    if (!gameTouched && !lockedGame && box.boardGame) {
      setSelected({
        kind: "existing",
        id: box.boardGame.id,
        title: box.boardGame.title,
      });
    }
  };

  const clearBaseSet = () => {
    setBaseSet(null);
    if (!gameTouched && !lockedGame) setSelected(null);
  };

  const submit = async () => {
    if (!canCreate) return;
    // Only fields with a non-empty value become CustomFieldValue entries, in
    // the same shape the detail pages send.
    const customFieldValues: CustomFieldValue[] = definitions
      .filter((def) => (values[def.id] ?? "") !== "")
      .map((def) => toCustomFieldValue(def, values[def.id]));
    const ok = await onCreate({
      title: title.trim(),
      isExpansion,
      isStandAlone: standAlone === "true",
      baseSetId: isExpansion ? (baseSet?.id ?? null) : null,
      // Exactly one of boardGameId / boardGame, per BoardGameBoxRequest.
      boardGameId: lockedGame
        ? lockedGame.id
        : selected?.kind === "existing"
          ? selected.id
          : null,
      boardGame:
        !lockedGame && selected?.kind === "new" ? selected.input : null,
      customFieldValues,
    });
    // Keep the form (and the user's input) on failure so they can retry.
    if (!ok) return;
    if (massInputMode) {
      // Clear the form — game and base set included — for the next entry; the
      // entryNonce effect refocuses Title. A locked game stays locked.
      setTitle("");
      setExpansion("false");
      setStandAlone("true");
      setValues(makeInitialValues());
      setSelected(null);
      setGameTouched(false);
      setPickerQuery("");
      setBaseSet(null);
      setBaseQuery("");
      setEntryNonce((n) => n + 1);
    } else {
      onClose();
    }
  };

  // Portal to <body> so the fixed backdrop escapes the page content's stacking
  // context (board-games.module.css .content is z-index 0). Rendered inline, the
  // backdrop's z-index 60 is trapped below the Header's z-index-2 .content and
  // the hero logo/title would paint over the modal. document is always defined
  // here — the modal only mounts on a client-side open.
  return createPortal(
    <>
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
          aria-labelledby="board-game-box-create-title"
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={trapTab}
        >
          <div className={styles.head}>
            <h2 id="board-game-box-create-title" className={styles.title}>
              Create Board Game Box
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

          {/* The expansion's base set. Only rendered for expansions; picking
              one may auto-default the game section below. */}
          {isExpansion && (
            <div className={gameStyles.games}>
              <div className={gameStyles.gamesHead}>
                <span className={gameStyles.gamesTitle}>Base Set</span>
              </div>

              {baseSet === null ? (
                <div className={gameStyles.empty}>
                  Optionally pick the box this expands.
                </div>
              ) : (
                <ul aria-label="Base set" className={gameStyles.list}>
                  <li className={gameStyles.item}>
                    <span className={gameStyles.itemTitle}>
                      {baseSet.title}
                    </span>
                    {baseSet.boardGame && (
                      <span className={gameStyles.itemSystem}>
                        {baseSet.boardGame.title}
                      </span>
                    )}
                    <button
                      type="button"
                      className={gameStyles.remove}
                      aria-label={`Remove ${baseSet.title}`}
                      onClick={clearBaseSet}
                    >
                      <XIcon />
                    </button>
                  </li>
                </ul>
              )}

              <div className={gameStyles.picker}>
                <input
                  type="search"
                  className={gameStyles.pickerInput}
                  placeholder="Change the base set box..."
                  aria-label="Pick a base set"
                  value={baseQuery}
                  onFocus={loadBoxes}
                  onChange={(e) => setBaseQuery(e.target.value)}
                />
                {boxesError && (
                  <div className={gameStyles.pickerNote}>
                    Couldn&apos;t load the box list. Try again later.
                  </div>
                )}
                {!boxesError && baseSearch !== "" && loadingBoxes && (
                  <div className={gameStyles.pickerNote}>Loading boxes…</div>
                )}
                {!boxesError && baseSearch !== "" && allBoxes !== null && (
                  <ul
                    aria-label="Matching boxes"
                    className={gameStyles.results}
                  >
                    {boxMatches.length === 0 ? (
                      <li className={gameStyles.pickerNote}>No matches.</li>
                    ) : (
                      <>
                        {boxMatches.slice(0, PICKER_CAP).map((box) => (
                          <li key={box.id}>
                            <button
                              type="button"
                              className={gameStyles.result}
                              onClick={() => pickBaseSet(box)}
                            >
                              <span className={gameStyles.resultTitle}>
                                {box.title}
                              </span>
                              {box.boardGame && (
                                <span className={gameStyles.itemSystem}>
                                  {box.boardGame.title}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                        {boxMatches.length > PICKER_CAP && (
                          <li className={gameStyles.pickerNote}>
                            {boxMatches.length - PICKER_CAP} more — keep typing
                            to narrow it down.
                          </li>
                        )}
                      </>
                    )}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* The box's one board game: fixed when the caller locked it, else a
              brand-new game entered through the stacked dialog or an existing
              game attached via the picker. */}
          <div className={gameStyles.games}>
            <div className={gameStyles.gamesHead}>
              <span className={gameStyles.gamesTitle}>Board Game</span>
              {!lockedGame && selected === null && (
                <button
                  type="button"
                  className={gameStyles.addNew}
                  onClick={() => setAddingGame(true)}
                >
                  <PlusIcon aria-hidden="true" /> Add New Game
                </button>
              )}
            </div>

            {lockedGame ? (
              <ul aria-label="Board game for this box" className={gameStyles.list}>
                <li className={gameStyles.item}>
                  <span className={gameStyles.itemTitle}>
                    {lockedGame.title}
                  </span>
                  <span className={gameStyles.tag}>Linked</span>
                </li>
              </ul>
            ) : selected === null ? (
              <div className={gameStyles.empty}>Pick or create the game.</div>
            ) : (
              <ul aria-label="Board game for this box" className={gameStyles.list}>
                <li className={gameStyles.item}>
                  <span className={gameStyles.itemTitle}>
                    {selected.kind === "new"
                      ? selected.input.title
                      : selected.title}
                  </span>
                  <span className={gameStyles.tag}>
                    {selected.kind === "new" ? "New" : "Existing"}
                  </span>
                  <button
                    type="button"
                    className={gameStyles.remove}
                    aria-label={`Remove ${
                      selected.kind === "new"
                        ? selected.input.title
                        : selected.title
                    }`}
                    onClick={clearGame}
                  >
                    <XIcon />
                  </button>
                </li>
              </ul>
            )}

            {!lockedGame && selected === null && (
              <div className={gameStyles.picker}>
                <input
                  type="search"
                  className={gameStyles.pickerInput}
                  placeholder="Change the board game..."
                  aria-label="Pick an existing game"
                  value={pickerQuery}
                  onFocus={loadGames}
                  onChange={(e) => setPickerQuery(e.target.value)}
                />
                {gamesError && (
                  <div className={gameStyles.pickerNote}>
                    Couldn&apos;t load the game list. Try again later.
                  </div>
                )}
                {!gamesError && query !== "" && loadingGames && (
                  <div className={gameStyles.pickerNote}>Loading games…</div>
                )}
                {!gamesError && query !== "" && allGames !== null && (
                  <ul
                    aria-label="Matching games"
                    className={gameStyles.results}
                  >
                    {gameMatches.length === 0 ? (
                      <li className={gameStyles.pickerNote}>No matches.</li>
                    ) : (
                      <>
                        {gameMatches.slice(0, PICKER_CAP).map((game) => (
                          <li key={game.id}>
                            <button
                              type="button"
                              className={gameStyles.result}
                              onClick={() => pickExisting(game)}
                            >
                              <span className={gameStyles.resultTitle}>
                                {game.title}
                              </span>
                              {(game.boardGameBoxes?.length ?? 0) > 0 && (
                                <span className={gameStyles.resultBox}>
                                  in {game.boardGameBoxes[0].title}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                        {gameMatches.length > PICKER_CAP && (
                          <li className={gameStyles.pickerNote}>
                            {gameMatches.length - PICKER_CAP} more — keep
                            typing to narrow it down.
                          </li>
                        )}
                      </>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className={styles.foot}>
            <button type="button" className={styles.cancel} onClick={onClose}>
              Cancel
            </button>
            <button
              ref={createButtonRef}
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
      </div>

      {/* Stacked create-game dialog. A DOM sibling of the box dialog (not a
          child of modalRef) so each modal's focus trap owns its own subtree;
          its onCreate selects locally — nothing is persisted until the box
          itself is created. */}
      {addingGame && (
        <BoardGameCreateModal
          definitions={gameDefinitions}
          initialTitle={title}
          saving={false}
          onCreate={async (input) => {
            setGameTouched(true);
            setSelected({ kind: "new", input });
            focusCreateAfterGameRef.current = true;
            return true;
          }}
          onClose={() => setAddingGame(false)}
        />
      )}
    </>,
    document.body,
  );
}
