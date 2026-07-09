"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildCustomFieldValues,
  type CustomField,
  type CustomFieldType,
  type CustomFieldOption,
  type CustomFieldValue,
  type NewVideoGameInput,
  type System,
  type UpdateVideoGameBoxInput,
  type VideoGame,
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
import VideoGameCreateModal from "./VideoGameCreateModal";
import { useMobileShelf } from "@/lib/useMobileShelf";
import { searchVideoGamesClient } from "./searchClient";
import rowStyles from "@/components/toys/ToyDetail.module.css";
import styles from "@/components/toys/ToyCreateModal.module.css";
import gameStyles from "./VideoGameBoxCreateModal.module.css";

// Create-a-video-game-box dialog. The standard create-modal chrome (same
// stylesheet and focus/mass-input behaviors as ToyCreateModal), plus a Games
// section: a box is created with at least one game, assembled here from
// brand-new games (entered through a stacked VideoGameCreateModal and sent in
// the POST's newVideoGames) and/or existing games picked from the backend's
// game list (sent as existingVideoGameIds).

type Row = {
  key: string;
  name: string;
  kind: CustomFieldType;
  value: string;
  options?: CustomFieldOption[];
  standard?: boolean;
  onCommit: (value: string) => void;
};

// A game queued for the box being created. One ordered list (not two) so the
// rendered rows keep the order the user added them in.
type PendingGame =
  | { kind: "new"; key: string; input: NewVideoGameInput }
  | { kind: "existing"; key: string; game: VideoGame };

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

type VideoGameBoxCreateModalProps = {
  // The videoGameBox entity's custom fields (the form's rows).
  definitions: CustomField[];
  // The videoGame entity's custom fields, for the stacked create-game dialog.
  gameDefinitions: CustomField[];
  systems: System[];
  saving: boolean;
  // Persists the box and resolves to whether it succeeded, so the dialog can
  // close (normal) or reset for another entry (mass-input mode) accordingly.
  onCreate: (input: UpdateVideoGameBoxInput) => Promise<boolean>;
  onClose: () => void;
};

export default function VideoGameBoxCreateModal({
  definitions,
  gameDefinitions,
  systems,
  saving,
  onCreate,
  onClose,
}: VideoGameBoxCreateModalProps) {
  // Mass-input mode turns the dialog into a rapid data-entry loop: the button
  // becomes "Create And Add Another", each save clears the form and refocuses
  // Title, and the dialog closes via the X or Escape (no backdrop or Cancel).
  const { settings } = useUiSettings();
  const massInputMode = settings.massInputMode;

  // On mobile the dialog behaves as a shelf: slides in from the right, sits
  // below the header, slides back off to the right on close. requestClose plays that
  // exit before onClose unmounts; on desktop it closes immediately.
  const { requestClose, overlayStyle, slideStyle } = useMobileShelf();

  // Option fields start on their configured default; everything else empty.
  // Shared by the initial state and the post-save reset.
  function makeInitialValues(): Record<number, string> {
    const initial: Record<number, string> = {};
    for (const def of definitions) initial[def.id] = defaultValue(def);
    return initial;
  }

  const [title, setTitle] = useState("");
  const [systemName, setSystemName] = useState("");
  const [physical, setPhysical] = useState("false");
  const [values, setValues] = useState<Record<number, string>>(makeInitialValues);
  // The games queued for this box, plus whether the stacked create-game
  // dialog is open. newGameSeq keys the "new" entries (their titles needn't
  // be unique).
  const [pending, setPending] = useState<PendingGame[]>([]);
  const [addingGame, setAddingGame] = useState(false);
  const newGameSeq = useRef(0);
  // Existing-game picker: the full game list is fetched once on first focus
  // and filtered client-side.
  const [pickerQuery, setPickerQuery] = useState("");
  const [allGames, setAllGames] = useState<VideoGame[] | null>(null);
  const [loadingGames, setLoadingGames] = useState(false);
  const [gamesError, setGamesError] = useState(false);
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
    // Escape always closes the dialog, even in mass-input mode. While the
    // stacked create-game dialog is open, this listener detaches so Escape
    // closes only the child (its own listener handles it).
    if (addingGame) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose(onClose);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, addingGame, requestClose]);

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
  // opener (the Add New Game button) on unmount; this runs after that and wins,
  // leaving the user one keystroke from submitting the box. A game is now in the
  // list, so Create is enabled (and focusable) as long as the title is set.
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

  const selectedSystem = systems.find((s) => s.name === systemName);
  // A box must hold at least one game (the detail page likewise refuses to
  // remove the last one), so Create stays disabled until the list is non-empty.
  const canCreate =
    title.trim().length > 0 &&
    !!selectedSystem &&
    pending.length > 0 &&
    !saving;

  // The System row borrows the dropdown editor, with the systems list as its
  // options (committed by name, mapped back to a systemId on submit).
  const systemOptions: CustomFieldOption[] = systems.map((s, i) => ({
    id: s.id,
    customFieldId: -1,
    name: s.name,
    isDefault: false,
    order: i,
  }));

  // Title + System + Physical first, then the custom fields in their defined
  // order. Each field's onCommit just writes into local state — persistence
  // happens on submit.
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
      key: "system",
      name: "System",
      kind: "dropdown",
      value: systemName,
      options: systemOptions,
      standard: true,
      onCommit: setSystemName,
    },
    {
      key: "physical",
      name: "Physical",
      kind: "boolean",
      value: physical,
      standard: true,
      onCommit: setPhysical,
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
    searchVideoGamesClient([])
      .then(setAllGames)
      .catch((error) => {
        console.error("Load video games failed", error);
        setGamesError(true);
      })
      .finally(() => setLoadingGames(false));
  };

  const pendingExistingIds = new Set(
    pending.flatMap((p) => (p.kind === "existing" ? [p.game.id] : [])),
  );
  const query = pickerQuery.trim().toLowerCase();
  // Already-added games are hidden; games shelved in another box stay pickable
  // (multi-box membership is legal) but get a label so it's a deliberate act.
  const matches =
    query === "" || allGames === null
      ? []
      : allGames.filter(
          (g) =>
            g.title.toLowerCase().includes(query) &&
            !pendingExistingIds.has(g.id),
        );

  const addExisting = (game: VideoGame) => {
    setPending((p) => [
      ...p,
      { kind: "existing", key: `existing-${game.id}`, game },
    ]);
    setPickerQuery("");
  };

  const removePending = (key: string) => {
    setPending((p) => p.filter((g) => g.key !== key));
  };

  const submit = async () => {
    if (!canCreate || !selectedSystem) return;
    // Sends each set field plus every boolean (an untouched boolean shows "No"
    // and is saved as "false"), in the shape the detail pages use.
    const customFieldValues: CustomFieldValue[] = buildCustomFieldValues(
      definitions,
      values,
    );
    const ok = await onCreate({
      title: title.trim(),
      systemId: selectedSystem.id,
      existingVideoGameIds: pending.flatMap((p) =>
        p.kind === "existing" ? [p.game.id] : [],
      ),
      newVideoGames: pending.flatMap((p) =>
        p.kind === "new" ? [p.input] : [],
      ),
      isPhysical: physical === "true",
      customFieldValues,
    });
    // Keep the form (and the user's input) on failure so they can retry.
    if (!ok) return;
    if (massInputMode) {
      // Clear the form — games included — for the next entry, but keep the
      // chosen System: rapid entry usually stays on one system, so re-picking
      // it every time would be tedious. The entryNonce effect refocuses Title.
      setTitle("");
      setPhysical("false");
      setValues(makeInitialValues());
      setPending([]);
      setPickerQuery("");
      setEntryNonce((n) => n + 1);
    } else {
      requestClose(onClose);
    }
  };

  // Portal to <body> so the fixed backdrop escapes the page content's stacking
  // context (video-games.module.css .content is z-index 0). Rendered inline, the
  // backdrop's z-index 60 is trapped below the Header's z-index-2 .content and
  // the hero logo/title would paint over the modal. document is always defined
  // here — the modal only mounts on a client-side open.
  return createPortal(
    <>
      <div
        className={styles.backdrop}
        style={overlayStyle}
        // Mass-input mode disables accidental backdrop-to-close; exit via X/Cancel.
        onMouseDown={massInputMode ? undefined : () => requestClose(onClose)}
      >
        <div
          ref={modalRef}
          className={styles.modal}
          style={slideStyle}
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-game-box-create-title"
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={trapTab}
        >
          <div className={styles.head}>
            <h2 id="video-game-box-create-title" className={styles.title}>
              Create Video Game Box
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

          {/* The games going into the new box: brand-new ones entered through
              the stacked dialog, existing ones attached via the picker. */}
          <div className={gameStyles.games}>
            <div className={gameStyles.gamesHead}>
              <span className={gameStyles.gamesTitle}>Video Games</span>
              <button
                type="button"
                className={gameStyles.addNew}
                onClick={() => setAddingGame(true)}
              >
                <PlusIcon aria-hidden="true" /> Add New Game
              </button>
            </div>

            {pending.length === 0 ? (
              <div className={gameStyles.empty}>Add at least one game.</div>
            ) : (
              <ul aria-label="Games in this box" className={gameStyles.list}>
                {pending.map((p) => {
                  const gameTitle =
                    p.kind === "new" ? p.input.title : p.game.title;
                  const gameSystem =
                    p.kind === "new"
                      ? systems.find((s) => s.id === p.input.systemId)?.name
                      : p.game.system?.name;
                  return (
                    <li key={p.key} className={gameStyles.item}>
                      <span className={gameStyles.itemTitle}>{gameTitle}</span>
                      {gameSystem && (
                        <span className={gameStyles.itemSystem}>
                          {gameSystem}
                        </span>
                      )}
                      <span className={gameStyles.tag}>
                        {p.kind === "new" ? "New" : "Existing"}
                      </span>
                      <button
                        type="button"
                        className={gameStyles.remove}
                        aria-label={`Remove ${gameTitle}`}
                        onClick={() => removePending(p.key)}
                      >
                        <XIcon />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className={gameStyles.picker}>
              <input
                type="search"
                className={gameStyles.pickerInput}
                placeholder="Add an existing game..."
                aria-label="Add an existing game"
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
                  {matches.length === 0 ? (
                    <li className={gameStyles.pickerNote}>No matches.</li>
                  ) : (
                    <>
                      {matches.slice(0, PICKER_CAP).map((game) => (
                        <li key={game.id}>
                          <button
                            type="button"
                            className={gameStyles.result}
                            onClick={() => addExisting(game)}
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
                          {matches.length - PICKER_CAP} more — keep typing to
                          narrow it down.
                        </li>
                      )}
                    </>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className={styles.foot}>
            <button
              type="button"
              className={styles.cancel}
              onClick={() => requestClose(onClose)}
            >
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
          its onCreate appends locally — nothing is persisted until the box
          itself is created. */}
      {addingGame && (
        <VideoGameCreateModal
          definitions={gameDefinitions}
          systems={systems}
          defaultSystemId={selectedSystem?.id}
          initialTitle={title}
          saving={false}
          onCreate={async (input) => {
            newGameSeq.current += 1;
            setPending((p) => [
              ...p,
              { kind: "new", key: `new-${newGameSeq.current}`, input },
            ]);
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
