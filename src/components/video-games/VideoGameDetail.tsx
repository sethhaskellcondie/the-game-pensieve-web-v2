"use client";

import { useState } from "react";
import Link from "next/link";
import {
  toCustomFieldValue,
  type CustomField,
  type CustomFieldOption,
  type CustomFieldType,
  type CustomFieldValue,
  type System,
  type UpdateVideoGameInput,
  type VideoGame,
} from "@/lib/api";
import Header from "@/components/Header";
import Button from "@/components/Button";
import { VideoGamesIcon, SystemsIcon } from "@/components/icons";
import { ChevronLeftIcon } from "@/components/custom-fields/icons";
import {
  FIELD_TYPE_META,
  KindGlyph,
  STANDARD_FIELD_META,
  StandardFieldGlyph,
} from "@/components/custom-fields/registry";
import { useToast } from "@/components/ToastProvider";
import { useSession } from "@/components/auth/SessionProvider";
import { bffFetch } from "@/lib/bffClient";
// Aliased: CustomFieldValue (the type) is already imported from the API types.
import CustomFieldValueDisplay from "@/components/toys/CustomFieldValue";
import FieldEditor, {
  normalizeFieldValue,
} from "@/components/toys/toyFieldEditors";
import styles from "@/components/toys/ToyDetail.module.css";
// The chart styles are the box-detail chart's — same slim read-only rows.
import chartStyles from "@/components/video-games/VideoGameBoxDetail.module.css";

// One rendered field: the fixed Title/System rows and every custom field share
// this shape so a single row renderer drives them all. `kind` reuses the
// backend custom-field types so the standard fields borrow the text/dropdown
// editors. `standard` marks the built-in rows so they get the neutral
// standard-field glyph + label instead of a custom-field type's.
type Row = {
  key: string;
  name: string;
  kind: CustomFieldType;
  value: string;
  options?: CustomFieldOption[];
  standard?: boolean;
  onCommit: (value: string) => void;
};

export default function VideoGameDetail({
  game: initialGame,
  definitions,
  boxDefinitions,
  systems,
}: {
  game: VideoGame;
  definitions: CustomField[];
  // The videoGameBox entity's custom-field definitions — they drive the columns
  // of the read-only boxes chart.
  boxDefinitions: CustomField[];
  systems: System[];
}) {
  const { showToast, showSnackbar } = useToast();
  const { canWrite } = useSession();
  const [game, setGame] = useState<VideoGame>(initialGame);

  // Optimistically apply `next`, then persist the whole game (title + systemId
  // + values are all required by the backend). Roll back and surface the error
  // on failure.
  const persist = async (next: VideoGame) => {
    let prev: VideoGame = game;
    setGame((cur) => {
      prev = cur;
      return next;
    });
    try {
      const input: UpdateVideoGameInput = {
        title: next.title,
        systemId: next.system.id,
        customFieldValues: next.customFieldValues,
      };
      const res = await bffFetch(`/api/video-games/${next.id}`, {
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
      showToast({ message: "Video game updated.", variant: "success" });
    } catch (error) {
      console.error("Update video game failed", error);
      setGame(prev);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't update the video game: ${error.message}`
            : "Couldn't update the video game. Please try again.",
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

  // The System dropdown commits by name; map it back to the system itself
  // (duplicate names resolve to the first match). Unknown or unchanged picks
  // are no-ops.
  const commitSystem = (systemName: string) => {
    const next = systems.find((s) => s.name === systemName);
    if (!next || next.id === game.system.id) return;
    void persist({ ...game, system: next });
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

  // The System row borrows the dropdown editor, with the systems list as its
  // options (committed by name, mapped back to a systemId on persist).
  const systemOptions: CustomFieldOption[] = systems.map((s, i) => ({
    id: s.id,
    customFieldId: -1,
    name: s.name,
    isDefault: false,
    order: i,
  }));

  // Title + System first (guaranteeing at least two rows), then the custom
  // fields in their defined order.
  const rows: Row[] = [
    { key: "title", name: "Title", kind: "text", value: game.title, standard: true, onCommit: commitTitle },
    { key: "system", name: "System", kind: "dropdown", value: game.system?.name ?? "", options: systemOptions, standard: true, onCommit: commitSystem },
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

  const boxes = game.videoGameBoxes ?? [];

  return (
    <>
      <Header
        icon={<VideoGamesIcon />}
        title="VIDEO GAME"
        tagline={`${game.title} · ${game.system?.name ?? ""}`}
      />

      <main className={styles.main}>
        <div className={styles.wrap}>
          <div className={styles.topbar}>
            {/* Explicit ?view=list: the bare URL follows the user's default
                view, but game details are reached from the list. */}
            <Button href="/video-games?view=list" className={styles.backbtn}>
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
                    {/* Editing is a write — guests/lapsed see the value read-only. */}
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

          {/* The boxes this game belongs to as a slim read-only chart: title,
              the box's system chip, its physical/collection flags, and one cell
              per videoGameBox custom field. The whole row links to the box's
              detail page. Boxes are edited (and the membership managed) on their
              own detail pages, not here. */}
          <div className={`${styles.card} ${chartStyles.gamesCard}`}>
            <div className={styles.caphdr}>
              <span className={styles.caphdrTitle}>Video Game Boxes</span>
              <span className={styles.caphdrCount}>
                <b>{boxes.length}</b> {boxes.length === 1 ? "box" : "boxes"}
              </span>
            </div>
            {boxes.length === 0 ? (
              <div className={styles.row}>
                <span className={styles.vText}>No boxes yet.</span>
              </div>
            ) : (
              <ul aria-label="Video game boxes" className={chartStyles.gameList}>
                {boxes.map((box) => (
                  <li className={chartStyles.game} key={box.id}>
                    <div>
                      <div className={chartStyles.gameHead}>
                        <Link
                          href={`/video-game-boxes/${box.id}`}
                          className={chartStyles.gameTitle}
                        >
                          {box.title}
                        </Link>
                        {box.system && (
                          <span className={chartStyles.systemChip}>
                            <SystemsIcon aria-hidden="true" />
                            {box.system.name}
                          </span>
                        )}
                        {box.collection && (
                          <span className={chartStyles.systemChip}>
                            Collection
                          </span>
                        )}
                      </div>

                      <div className={chartStyles.fieldGrid}>
                        <div>
                          <div className={chartStyles.fieldLabel}>Physical</div>
                          <div className={chartStyles.fieldValue}>
                            <CustomFieldValueDisplay
                              type="boolean"
                              value={box.physical ? "true" : "false"}
                            />
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
    </>
  );
}
