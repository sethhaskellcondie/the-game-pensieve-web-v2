"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CustomField,
  CustomFieldType,
  CustomFieldOption,
  CustomFieldValue,
  NewVideoGameInput,
  System,
  UpdateVideoGameBoxInput,
  VideoGame,
} from "@/lib/api";
import {
  FIELD_TYPE_META,
  KindGlyph,
  STANDARD_FIELD_META,
  StandardFieldGlyph,
} from "@/components/custom-fields/registry";
import { PlusIcon, XIcon } from "@/components/custom-fields/icons";
import { useUiSettings } from "@/components/UiSettingsProvider";
import FieldEditor from "@/components/toys/toyFieldEditors";
import VideoGameCreateModal from "./VideoGameCreateModal";
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

  // Move focus into the dialog on open so a keyboard user starts inside it, and
  // return it to whatever opened the dialog (the New button) when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    getFocusable(modalRef.current)[0]?.focus();
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
    // Only fields with a non-empty value become CustomFieldValue entries, in
    // the same shape the detail pages send.
    const customFieldValues: CustomFieldValue[] = definitions
      .filter((def) => (values[def.id] ?? "") !== "")
      .map((def) => ({
        customFieldId: def.id,
        customFieldName: def.name,
        customFieldType: def.type,
        value: values[def.id],
      }));
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
      // Clear the form — games included — for the next entry; the entryNonce
      // effect refocuses Title.
      setTitle("");
      setSystemName("");
      setPhysical("false");
      setValues(makeInitialValues());
      setPending([]);
      setPickerQuery("");
      setEntryNonce((n) => n + 1);
    } else {
      onClose();
    }
  };

  return (
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
                placeholder="Add an existing game — type to search…"
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
            <button type="button" className={styles.cancel} onClick={onClose}>
              Cancel
            </button>
            <button
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
          saving={false}
          onCreate={async (input) => {
            newGameSeq.current += 1;
            setPending((p) => [
              ...p,
              { kind: "new", key: `new-${newGameSeq.current}`, input },
            ]);
            return true;
          }}
          onClose={() => setAddingGame(false)}
        />
      )}
    </>
  );
}
