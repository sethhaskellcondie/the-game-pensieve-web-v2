"use client";

import { useState } from "react";
import Link from "next/link";
import {
  toCustomFieldValue,
  type BoardGameBox,
  type CustomField,
  type CustomFieldOption,
  type CustomFieldType,
  type CustomFieldValue,
  type SlimBoardGame,
  type UpdateBoardGameBoxInput,
} from "@/lib/api";
import Header from "@/components/Header";
import Button from "@/components/Button";
import { BoardGameBoxIcon } from "@/components/icons";
import { ChevronLeftIcon, XIcon } from "@/components/custom-fields/icons";
import {
  FIELD_TYPE_META,
  KindGlyph,
  STANDARD_FIELD_META,
  StandardFieldGlyph,
} from "@/components/custom-fields/registry";
import { useToast } from "@/components/ToastProvider";
import { useSession } from "@/components/auth/SessionProvider";
import { bffFetch } from "@/lib/bffClient";
import DeleteEntityButton from "@/components/detail/DeleteEntityButton";
// Aliased: CustomFieldValue (the type) is already imported from the API types.
import CustomFieldValueDisplay from "@/components/toys/CustomFieldValue";
import FieldEditor, {
  normalizeFieldValue,
} from "@/components/toys/toyFieldEditors";
import {
  searchBoardGamesClient,
  searchBoardGameBoxesClient,
} from "./searchClient";
import styles from "@/components/toys/ToyDetail.module.css";
// The chart styles are the box-detail chart's — same slim read-only rows —
// and the picker styles are the create dialog's search-and-pick pattern.
import chartStyles from "@/components/video-games/VideoGameBoxDetail.module.css";
import pickerStyles from "@/components/video-games/VideoGameBoxCreateModal.module.css";

// One rendered field — the same Row shape the other detail pages use, so a
// single row renderer drives the standard rows and the custom fields alike.
type Row = {
  key: string;
  name: string;
  kind: CustomFieldType;
  value: string;
  options?: CustomFieldOption[];
  standard?: boolean;
  onCommit: (value: string) => void;
};

// The picker only renders this many matches; narrower queries find the rest.
const PICKER_CAP = 25;

export default function BoardGameBoxDetail({
  box: initialBox,
  definitions,
  gameDefinitions,
  allBoxes,
}: {
  box: BoardGameBox;
  definitions: CustomField[];
  // The boardGame entity's custom-field definitions — they render the linked
  // game's value grid (and provide the options for option-bearing values).
  gameDefinitions: CustomField[];
  // Every box, fetched server-side: the initial seed for the base-set picker's
  // options and the current base set's title resolution. Refreshed client-side
  // on picker focus (see loadBoxes).
  allBoxes: BoardGameBox[];
}) {
  const { showToast, showSnackbar } = useToast();
  const { canWrite } = useSession();
  const [box, setBox] = useState<BoardGameBox>(initialBox);
  // Base-set picker: seeded from the server snapshot so the card renders
  // instantly, then refreshed client-side on focus. The backend never tells the
  // client when a box is created or deleted elsewhere, so the snapshot can go
  // stale; refetching on focus keeps a dead box from lingering as an option.
  const [baseQuery, setBaseQuery] = useState("");
  const [boxes, setBoxes] = useState<BoardGameBox[]>(allBoxes);
  const [loadingBoxes, setLoadingBoxes] = useState(false);
  const [boxesError, setBoxesError] = useState(false);
  // Linked-game picker: the game list is fetched once on first focus and
  // filtered client-side, like the create dialog's pickers.
  const [gameQuery, setGameQuery] = useState("");
  const [allGames, setAllGames] = useState<
    Awaited<ReturnType<typeof searchBoardGamesClient>> | null
  >(null);
  const [loadingGames, setLoadingGames] = useState(false);
  const [gamesError, setGamesError] = useState(false);

  // Optimistically apply `next`, then persist the whole box — the backend's
  // BoardGameBoxUpdateRequest requires every field, including the linked
  // game's id. Roll back and surface the error on failure.
  const persist = async (next: BoardGameBox) => {
    let prev: BoardGameBox = box;
    setBox((cur) => {
      prev = cur;
      return next;
    });
    try {
      const input: UpdateBoardGameBoxInput = {
        title: next.title,
        isExpansion: next.isExpansion,
        isStandAlone: next.isStandAlone,
        baseSetId: next.baseSetId,
        boardGameId: next.boardGame.id,
        customFieldValues: next.customFieldValues,
      };
      const res = await bffFetch(`/api/board-game-boxes/${next.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "Request failed");
      }
      showToast({ message: "Board game box updated.", variant: "success" });
    } catch (error) {
      console.error("Update board game box failed", error);
      setBox(prev);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't update the board game box: ${error.message}`
            : "Couldn't update the board game box. Please try again.",
        variant: "error",
      });
    }
  };

  // Title is required by the backend (minLength 1), so a blank commit is a no-op.
  const commitTitle = (raw: string) => {
    const title = raw.trim();
    if (title === "" || title === box.title) return;
    void persist({ ...box, title });
  };

  // Turning Expansion off makes the base set meaningless, so it's cleared in
  // the same write.
  const commitExpansion = (raw: string) => {
    const isExpansion = raw === "true";
    if (isExpansion === box.isExpansion) return;
    void persist({
      ...box,
      isExpansion,
      baseSetId: isExpansion ? box.baseSetId : null,
    });
  };

  const commitStandAlone = (raw: string) => {
    const isStandAlone = raw === "true";
    if (isStandAlone === box.isStandAlone) return;
    void persist({ ...box, isStandAlone });
  };

  // Replace (or insert) this field's value in the box's customFieldValues.
  const commitField = (def: CustomField, raw: string) => {
    const current =
      box.customFieldValues.find((v) => v.customFieldId === def.id)?.value ??
      "";
    if (raw === current) return;
    const entry: CustomFieldValue = toCustomFieldValue(def, raw);
    const exists = box.customFieldValues.some(
      (v) => v.customFieldId === def.id,
    );
    const customFieldValues = exists
      ? box.customFieldValues.map((v) =>
          v.customFieldId === def.id ? entry : v,
        )
      : [...box.customFieldValues, entry];
    void persist({ ...box, customFieldValues });
  };

  // Base set picks and clears commit by id — never by name.
  const commitBaseSet = (id: number | null) => {
    setBaseQuery("");
    if (id === box.baseSetId) return;
    void persist({ ...box, baseSetId: id });
  };

  // Relink the box to another game. Optimistic like every other commit — the
  // search response carries everything SlimBoardGame needs.
  const commitGame = (game: SlimBoardGame) => {
    setGameQuery("");
    if (game.id === box.boardGame.id) return;
    void persist({ ...box, boardGame: game }).then(() => {
      // Reassigning can leave the previous game with no boxes, which the
      // backend silently deletes — it never tells the client. Refetch so the
      // now-dead game drops out of the picker's cached list (only worth doing
      // if that list was already loaded).
      if (allGames !== null) fetchGames();
    });
  };

  // Fetch the full game list, replacing any cached copy. Drives both the
  // picker's lazy first load and the post-reassignment refresh above.
  const fetchGames = () => {
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

  // Fetch the full game list once, on the picker's first focus.
  const loadGames = () => {
    if (allGames !== null || loadingGames) return;
    fetchGames();
  };

  // Refetch the box list, replacing the seeded copy. A failed refresh keeps the
  // last-good list (so the picker still works) and surfaces a note.
  const fetchBoxes = () => {
    setLoadingBoxes(true);
    setBoxesError(false);
    searchBoardGameBoxesClient([])
      .then(setBoxes)
      .catch((error) => {
        console.error("Load board game boxes failed", error);
        setBoxesError(true);
      })
      .finally(() => setLoadingBoxes(false));
  };

  // Refresh the box list whenever the base-set picker is focused, skipping a
  // fetch already in flight — so reopening the picker always reflects boxes
  // added or removed since the page loaded.
  const loadBoxes = () => {
    if (loadingBoxes) return;
    fetchBoxes();
  };

  // Title + the expansion flags first, then the custom fields in their
  // defined order. Base Set is deliberately absent from the editors — it's an
  // id-keyed relationship, picked through the Base Set card below.
  const rows: Row[] = [
    { key: "title", name: "Title", kind: "text", value: box.title, standard: true, onCommit: commitTitle },
    { key: "expansion", name: "Expansion", kind: "boolean", value: box.isExpansion ? "true" : "false", standard: true, onCommit: commitExpansion },
    { key: "standAlone", name: "Stand Alone", kind: "boolean", value: box.isStandAlone ? "true" : "false", standard: true, onCommit: commitStandAlone },
    ...definitions.map<Row>((def) => {
      const options = [...def.options].sort((a, b) => a.order - b.order);
      const raw = box.customFieldValues.find(
        (v) => v.customFieldId === def.id,
      )?.value;
      return {
        key: `cf-${def.id}`,
        name: def.name,
        kind: def.type,
        // Invalid stored values fall back to the empty state.
        value: normalizeFieldValue(def.type, raw, options),
        options,
        onCommit: (v: string) => commitField(def, v),
      };
    }),
  ];

  const baseSet =
    box.baseSetId == null
      ? null
      : (boxes.find((b) => b.id === box.baseSetId) ?? null);

  const baseSearch = baseQuery.trim().toLowerCase();
  // The box can't be its own base set; the current pick is hidden too.
  const baseMatches =
    baseSearch === ""
      ? []
      : boxes.filter(
          (b) =>
            b.id !== box.id &&
            b.id !== box.baseSetId &&
            b.title.toLowerCase().includes(baseSearch),
        );

  const gameSearch = gameQuery.trim().toLowerCase();
  const gameMatches =
    gameSearch === "" || allGames === null
      ? []
      : allGames.filter(
          (g) =>
            g.id !== box.boardGame.id &&
            g.title.toLowerCase().includes(gameSearch),
        );

  const game = box.boardGame;

  return (
    <>
      <Header
        icon={<BoardGameBoxIcon />}
        title="BOARD GAME"
        titleAccent="BOX"
        tagline={`${box.title} · ${game?.title ?? ""}`}
      />

      <main className={styles.main}>
        <div className={styles.wrap}>
          <div className={styles.topbar}>
            <Button href="/board-games?view=shelf" className={styles.backbtn}>
              <ChevronLeftIcon aria-hidden="true" /> Back
            </Button>
          </div>

          <div className={styles.card}>
            <div className={styles.caphdr}>
              <span className={styles.caphdrTitle}>Fields</span>
              <span className={styles.caphdrCount}>
                <b>{definitions.length}</b>{" "}
                {definitions.length === 1 ? "custom field" : "custom fields"}
              </span>
            </div>

            {rows.map((row) => {
              const meta = row.standard
                ? STANDARD_FIELD_META
                : FIELD_TYPE_META[row.kind];
              return (
                <div className={styles.row} key={row.key}>
                  <div className={styles.rowlabel}>
                    <span
                      className={styles.glyph}
                      style={{ background: meta.bg, color: meta.fg }}
                    >
                      {row.standard ? (
                        <StandardFieldGlyph size={15} />
                      ) : (
                        <KindGlyph type={row.kind} size={15} />
                      )}
                    </span>
                    <span className={styles.lblwrap}>
                      <div className={styles.lbl}>{row.name}</div>
                      <div className={styles.lblkind}>{meta.label}</div>
                    </span>
                  </div>
                  <div className={styles.rowval}>
                    {/* Editing a field is a write, so only an active (Paid)
                        account gets the editor; everyone else sees the value
                        read-only. */}
                    {canWrite ? (
                      <FieldEditor
                        field={{
                          name: row.name,
                          kind: row.kind,
                          value: row.value,
                          options: row.options,
                        }}
                        onCommit={row.onCommit}
                      />
                    ) : (
                      <CustomFieldValueDisplay
                        type={row.kind}
                        value={row.value}
                        options={row.options}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* The expansion's base set: the current pick as a link, an X to
              clear it, and a searchable picker over every other box. Only
              expansions have one. Commits by id, not name. */}
          {box.isExpansion && (
            <div className={`${styles.card} ${chartStyles.gamesCard}`}>
              <div className={styles.caphdr}>
                <span className={styles.caphdrTitle}>Base Set</span>
              </div>

              {baseSet === null ? (
                <div className={styles.row}>
                  <span className={styles.vText}>
                    {box.baseSetId == null
                      ? "No base set picked."
                      : "Base set not found."}
                  </span>
                </div>
              ) : (
                <ul aria-label="Base set" className={chartStyles.gameList}>
                  <li className={chartStyles.game}>
                    <div>
                      <div className={chartStyles.gameHead}>
                        <Link
                          href={`/board-game-boxes/${baseSet.id}`}
                          className={chartStyles.gameTitle}
                        >
                          {baseSet.title}
                        </Link>
                      </div>

                      {/* The base set's own fields, read-only — the same grid
                          the Board Game card uses, so the two cards read alike.
                          Board Game / Expansion / Stand Alone first, then the
                          box's custom fields in their defined order. */}
                      <div className={chartStyles.fieldGrid}>
                        <div>
                          <div className={chartStyles.fieldLabel}>
                            Board Game
                          </div>
                          <div className={chartStyles.fieldValue}>
                            {baseSet.boardGame?.title ?? "—"}
                          </div>
                        </div>
                        <div>
                          <div className={chartStyles.fieldLabel}>
                            Expansion
                          </div>
                          <div className={chartStyles.fieldValue}>
                            <CustomFieldValueDisplay
                              type="boolean"
                              value={String(baseSet.isExpansion)}
                            />
                          </div>
                        </div>
                        <div>
                          <div className={chartStyles.fieldLabel}>
                            Stand Alone
                          </div>
                          <div className={chartStyles.fieldValue}>
                            <CustomFieldValueDisplay
                              type="boolean"
                              value={String(baseSet.isStandAlone)}
                            />
                          </div>
                        </div>
                        {definitions.map((def) => (
                          <div key={def.id}>
                            <div className={chartStyles.fieldLabel}>
                              {def.name}
                            </div>
                            <div className={chartStyles.fieldValue}>
                              <CustomFieldValueDisplay
                                type={def.type}
                                value={
                                  baseSet.customFieldValues.find(
                                    (v) => v.customFieldId === def.id,
                                  )?.value
                                }
                                options={def.options}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Clearing the base set is a write, so the control shows
                        only for an active (Paid) account. Raised above the
                        row's stretched title link so it still receives the
                        click. */}
                    {canWrite && (
                      <div className={chartStyles.delwrap}>
                        <button
                          type="button"
                          className={pickerStyles.remove}
                          aria-label={`Remove ${baseSet.title}`}
                          onClick={() => commitBaseSet(null)}
                        >
                          <XIcon />
                        </button>
                      </div>
                    )}
                  </li>
                </ul>
              )}

              {/* Picking/changing the base set is a write, so the picker shows
                  only for an active (Paid) account. */}
              {canWrite && (
              <div className={pickerStyles.picker}>
                <input
                  type="search"
                  className={pickerStyles.pickerInput}
                  placeholder="Edit the base set..."
                  aria-label="Pick a base set"
                  value={baseQuery}
                  onFocus={loadBoxes}
                  onChange={(e) => setBaseQuery(e.target.value)}
                />
                {boxesError && (
                  <div className={pickerStyles.pickerNote}>
                    Couldn&apos;t refresh the box list. Showing the last loaded
                    copy.
                  </div>
                )}
                {baseSearch !== "" && (
                  <ul
                    aria-label="Matching boxes"
                    className={pickerStyles.results}
                  >
                    {baseMatches.length === 0 ? (
                      <li className={pickerStyles.pickerNote}>No matches.</li>
                    ) : (
                      <>
                        {baseMatches.slice(0, PICKER_CAP).map((b) => (
                          <li key={b.id}>
                            <button
                              type="button"
                              className={pickerStyles.result}
                              onClick={() => commitBaseSet(b.id)}
                            >
                              <span className={pickerStyles.resultTitle}>
                                {b.title}
                              </span>
                              {b.boardGame && (
                                <span className={pickerStyles.itemSystem}>
                                  {b.boardGame.title}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                        {baseMatches.length > PICKER_CAP && (
                          <li className={pickerStyles.pickerNote}>
                            {baseMatches.length - PICKER_CAP} more — keep
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
          )}

          {/* The box's one board game: its title links to the game's detail
              page, its custom-field values render read-only, and the picker
              relinks the box to another game (a box always has exactly one). */}
          <div className={`${styles.card} ${chartStyles.gamesCard}`}>
            <div className={styles.caphdr}>
              <span className={styles.caphdrTitle}>Board Game</span>
            </div>

            <ul aria-label="Board game" className={chartStyles.gameList}>
              <li className={chartStyles.game}>
                <div>
                  <div className={chartStyles.gameHead}>
                    <Link
                      href={`/board-games/${game.id}`}
                      className={chartStyles.gameTitle}
                    >
                      {game.title}
                    </Link>
                  </div>

                  <div className={chartStyles.fieldGrid}>
                    {gameDefinitions.map((def) => (
                      <div key={def.id}>
                        <div className={chartStyles.fieldLabel}>{def.name}</div>
                        <div className={chartStyles.fieldValue}>
                          <CustomFieldValueDisplay
                            type={def.type}
                            value={
                              game.customFieldValues.find(
                                (v) => v.customFieldId === def.id,
                              )?.value
                            }
                            options={def.options}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            </ul>

            {/* Relinking the box to another game is a write, so the picker
                shows only for an active (Paid) account. */}
            {canWrite && (
            <div className={pickerStyles.picker}>
              <input
                type="search"
                className={pickerStyles.pickerInput}
                placeholder="Edit the board game..."
                aria-label="Edit the board game"
                value={gameQuery}
                onFocus={loadGames}
                onChange={(e) => setGameQuery(e.target.value)}
              />
              {gamesError && (
                <div className={pickerStyles.pickerNote}>
                  Couldn&apos;t load the game list. Try again later.
                </div>
              )}
              {!gamesError && gameSearch !== "" && loadingGames && (
                <div className={pickerStyles.pickerNote}>Loading games…</div>
              )}
              {!gamesError && gameSearch !== "" && allGames !== null && (
                <ul
                  aria-label="Matching games"
                  className={pickerStyles.results}
                >
                  {gameMatches.length === 0 ? (
                    <li className={pickerStyles.pickerNote}>No matches.</li>
                  ) : (
                    <>
                      {gameMatches.slice(0, PICKER_CAP).map((g) => (
                        <li key={g.id}>
                          <button
                            type="button"
                            className={pickerStyles.result}
                            onClick={() => commitGame(g)}
                          >
                            <span className={pickerStyles.resultTitle}>
                              {g.title}
                            </span>
                          </button>
                        </li>
                      ))}
                      {gameMatches.length > PICKER_CAP && (
                        <li className={pickerStyles.pickerNote}>
                          {gameMatches.length - PICKER_CAP} more — keep typing
                          to narrow it down.
                        </li>
                      )}
                    </>
                  )}
                </ul>
              )}
            </div>
            )}
          </div>

          <DeleteEntityButton
            endpoint={`/api/board-game-boxes/${box.id}`}
            label="Delete Board Game Box"
            successMessage="Board game box deleted."
            errorNoun="board game box"
            backHref="/board-games?view=shelf"
          />
        </div>
      </main>
    </>
  );
}
