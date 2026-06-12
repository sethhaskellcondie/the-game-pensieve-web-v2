"use client";

import { useState } from "react";
import Link from "next/link";
import {
  toCustomFieldValue,
  type BoardGame,
  type BoardGameBox,
  type CreateBoardGameBoxInput,
  type CustomField,
  type CustomFieldOption,
  type CustomFieldType,
  type CustomFieldValue,
  type SlimBoardGameBox,
  type UpdateBoardGameInput,
} from "@/lib/api";
import Header from "@/components/Header";
import Button from "@/components/Button";
import { BoardGamesIcon } from "@/components/icons";
import { ChevronLeftIcon, PlusIcon } from "@/components/custom-fields/icons";
import BoardGameBoxCreateModal from "./BoardGameBoxCreateModal";
import {
  FIELD_TYPE_META,
  KindGlyph,
  STANDARD_FIELD_META,
  StandardFieldGlyph,
} from "@/components/custom-fields/registry";
import { useToast } from "@/components/ToastProvider";
// Aliased: CustomFieldValue (the type) is already imported from the API types.
import CustomFieldValueDisplay from "@/components/toys/CustomFieldValue";
import FieldEditor, {
  normalizeFieldValue,
} from "@/components/toys/toyFieldEditors";
import styles from "@/components/toys/ToyDetail.module.css";
// The chart styles are the box-detail chart's — same slim read-only rows.
import chartStyles from "@/components/video-games/VideoGameBoxDetail.module.css";

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

export default function BoardGameDetail({
  game: initialGame,
  definitions,
  boxDefinitions,
}: {
  game: BoardGame;
  definitions: CustomField[];
  // The boardGameBox entity's custom-field definitions — they drive the
  // columns of the read-only boxes chart and the embedded create-box dialog.
  boxDefinitions: CustomField[];
}) {
  const { showToast, showSnackbar } = useToast();
  const [game, setGame] = useState<BoardGame>(initialGame);
  // Create-box dialog state: open flag + in-flight guard for its save button.
  const [creating, setCreating] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);

  // Optimistically apply `next`, then persist the whole game (title + values
  // are both required by the backend). Roll back and surface the error on
  // failure.
  const persist = async (next: BoardGame) => {
    let prev: BoardGame = game;
    setGame((cur) => {
      prev = cur;
      return next;
    });
    try {
      const input: UpdateBoardGameInput = {
        title: next.title,
        customFieldValues: next.customFieldValues,
      };
      const res = await fetch(`/api/board-games/${next.id}`, {
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
      showToast({ message: "Board game updated.", variant: "success" });
    } catch (error) {
      console.error("Update board game failed", error);
      setGame(prev);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't update the board game: ${error.message}`
            : "Couldn't update the board game. Please try again.",
        variant: "error",
      });
    }
  };

  // Title is required by the backend (minLength 1), so a blank commit is a no-op.
  const commitTitle = (raw: string) => {
    const title = raw.trim();
    if (title === "" || title === game.title) return;
    void persist({ ...game, title });
  };

  // Replace (or insert) this field's value in the game's customFieldValues.
  const commitField = (def: CustomField, raw: string) => {
    const current =
      game.customFieldValues.find((v) => v.customFieldId === def.id)?.value ??
      "";
    if (raw === current) return;
    const entry: CustomFieldValue = toCustomFieldValue(def, raw);
    const exists = game.customFieldValues.some(
      (v) => v.customFieldId === def.id,
    );
    const customFieldValues = exists
      ? game.customFieldValues.map((v) =>
          v.customFieldId === def.id ? entry : v,
        )
      : [...game.customFieldValues, entry];
    void persist({ ...game, customFieldValues });
  };

  // Create a box for this game: POST it with the game's id locked in, then
  // append the created box (slimmed to the chart's shape) to local state.
  // Returns whether it succeeded; the dialog decides what to do next (close,
  // or reset for another entry in mass-input mode).
  const handleCreateBox = async (
    input: CreateBoardGameBoxInput,
  ): Promise<boolean> => {
    setSavingCreate(true);
    try {
      const res = await fetch("/api/board-game-boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: BoardGameBox;
        message?: string;
      } | null;
      if (!res.ok || !payload?.data) {
        throw new Error(payload?.message ?? "Request failed");
      }
      const created = payload.data;
      const slim: SlimBoardGameBox = {
        id: created.id,
        title: created.title,
        isExpansion: created.isExpansion,
        isStandAlone: created.isStandAlone,
        baseSetId: created.baseSetId,
        customFieldValues: created.customFieldValues,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        deletedAt: created.deletedAt,
      };
      setGame((cur) => ({
        ...cur,
        boardGameBoxes: [...(cur.boardGameBoxes ?? []), slim],
      }));
      showToast({ message: "Board game box created.", variant: "success" });
      return true;
    } catch (error) {
      console.error("Create board game box failed", error);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't create the board game box: ${error.message}`
            : "Couldn't create the board game box. Please try again.",
        variant: "error",
      });
      return false;
    } finally {
      setSavingCreate(false);
    }
  };

  // Title first, then the custom fields in their defined order.
  const rows: Row[] = [
    { key: "title", name: "Title", kind: "text", value: game.title, standard: true, onCommit: commitTitle },
    ...definitions.map<Row>((def) => {
      const options = [...def.options].sort((a, b) => a.order - b.order);
      const raw = game.customFieldValues.find(
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

  const boxes = game.boardGameBoxes ?? [];
  // Base sets resolve among this game's own boxes (an expansion's base set is
  // almost always one of them); anything outside shows a dash.
  const boxTitleById = new Map(boxes.map((b) => [b.id, b.title]));

  return (
    <>
      <Header
        icon={<BoardGamesIcon />}
        title="BOARD GAME"
        tagline={game.title}
      />

      <main className={styles.main}>
        <div className={styles.wrap}>
          <div className={styles.topbar}>
            {/* Explicit ?view=list: the bare URL follows the user's default
                view, but game details are reached from the list. */}
            <Button href="/board-games?view=list" className={styles.backbtn}>
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
                    <FieldEditor
                      field={{
                        name: row.name,
                        kind: row.kind,
                        value: row.value,
                        options: row.options,
                      }}
                      onCommit={row.onCommit}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* The boxes this game comes in as a slim read-only chart: title,
              the expansion flags, the base set, and one cell per boardGameBox
              custom field. The whole row links to the box's detail page.
              Boxes are edited (and deleted) on their own detail pages and the
              shelf view, not here. */}
          <div className={`${styles.card} ${chartStyles.gamesCard}`}>
            <div className={styles.caphdr}>
              <span className={styles.caphdrTitle}>Board Game Boxes</span>
              <button
                type="button"
                className={chartStyles.newBtn}
                onClick={() => setCreating(true)}
              >
                <PlusIcon aria-hidden="true" /> New Board Game Box
              </button>
              <span className={`${styles.caphdrCount} ${chartStyles.count}`}>
                <b>{boxes.length}</b> {boxes.length === 1 ? "box" : "boxes"}
              </span>
            </div>
            {boxes.length === 0 ? (
              <div className={styles.row}>
                <span className={styles.vText}>No boxes yet.</span>
              </div>
            ) : (
              <ul aria-label="Board game boxes" className={chartStyles.gameList}>
                {boxes.map((box) => (
                  <li className={chartStyles.game} key={box.id}>
                    <div>
                      <div className={chartStyles.gameHead}>
                        <Link
                          href={`/board-game-boxes/${box.id}`}
                          className={chartStyles.gameTitle}
                        >
                          {box.title}
                        </Link>
                        {box.isExpansion && (
                          <span className={chartStyles.systemChip}>
                            Expansion
                          </span>
                        )}
                      </div>

                      <div className={chartStyles.fieldGrid}>
                        <div>
                          <div className={chartStyles.fieldLabel}>
                            Stand Alone
                          </div>
                          <div className={chartStyles.fieldValue}>
                            <CustomFieldValueDisplay
                              type="boolean"
                              value={box.isStandAlone ? "true" : "false"}
                            />
                          </div>
                        </div>
                        <div>
                          <div className={chartStyles.fieldLabel}>
                            Base Set
                          </div>
                          <div className={chartStyles.fieldValue}>
                            {box.baseSetId == null
                              ? "—"
                              : (boxTitleById.get(box.baseSetId) ?? "—")}
                          </div>
                        </div>
                        {boxDefinitions.map((def) => (
                          <div key={def.id}>
                            <div className={chartStyles.fieldLabel}>
                              {def.name}
                            </div>
                            <div className={chartStyles.fieldValue}>
                              <CustomFieldValueDisplay
                                type={def.type}
                                value={
                                  box.customFieldValues.find(
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
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      {creating && (
        <BoardGameBoxCreateModal
          definitions={boxDefinitions}
          gameDefinitions={definitions}
          saving={savingCreate}
          lockedGame={{ id: game.id, title: game.title }}
          onCreate={handleCreateBox}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
