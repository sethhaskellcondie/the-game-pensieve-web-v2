"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  CustomField,
  CustomFieldOption,
  CustomFieldType,
  CustomFieldValue,
  System,
  UpdateVideoGameBoxInput,
  VideoGameBox,
} from "@/lib/api";
import Header from "@/components/Header";
import Button from "@/components/Button";
import BooleanBadge from "@/components/BooleanBadge";
import { VideoGameBoxIcon } from "@/components/icons";
import { ChevronLeftIcon } from "@/components/custom-fields/icons";
import {
  FIELD_TYPE_META,
  KindGlyph,
  STANDARD_FIELD_META,
  StandardFieldGlyph,
} from "@/components/custom-fields/registry";
import { useToast } from "@/components/ToastProvider";
import FieldEditor, {
  normalizeFieldValue,
} from "@/components/toys/toyFieldEditors";
import styles from "@/components/toys/ToyDetail.module.css";
import localStyles from "./VideoGameDetail.module.css";

// One rendered field — the same Row shape VideoGameDetail uses, so a single
// row renderer drives the standard rows and the custom fields alike.
type Row = {
  key: string;
  name: string;
  kind: CustomFieldType;
  value: string;
  options?: CustomFieldOption[];
  standard?: boolean;
  onCommit: (value: string) => void;
};

export default function VideoGameBoxDetail({
  box: initialBox,
  definitions,
  systems,
}: {
  box: VideoGameBox;
  definitions: CustomField[];
  systems: System[];
}) {
  const { showToast, showSnackbar } = useToast();
  const [box, setBox] = useState<VideoGameBox>(initialBox);

  // Optimistically apply `next`, then persist the whole box — the backend's
  // VideoGameBoxRequest requires every field, so the box's current game ids
  // ride along (newVideoGames stays empty: this page edits box fields only).
  // Roll back and surface the error on failure.
  const persist = async (next: VideoGameBox) => {
    let prev: VideoGameBox = box;
    setBox((cur) => {
      prev = cur;
      return next;
    });
    try {
      const input: UpdateVideoGameBoxInput = {
        title: next.title,
        systemId: next.system.id,
        existingVideoGameIds: next.videoGames.map((g) => g.id),
        newVideoGames: [],
        isPhysical: next.isPhysical,
        customFieldValues: next.customFieldValues,
      };
      const res = await fetch(`/api/video-game-boxes/${next.id}`, {
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
      showToast({ message: "Video game box updated.", variant: "success" });
    } catch (error) {
      console.error("Update video game box failed", error);
      setBox(prev);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't update the video game box: ${error.message}`
            : "Couldn't update the video game box. Please try again.",
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

  // The System dropdown commits by name; map it back to the system itself
  // (duplicate names resolve to the first match). Unknown or unchanged picks
  // are no-ops.
  const commitSystem = (systemName: string) => {
    const next = systems.find((s) => s.name === systemName);
    if (!next || next.id === box.system.id) return;
    void persist({ ...box, system: next });
  };

  const commitPhysical = (raw: string) => {
    const isPhysical = raw === "true";
    if (isPhysical === box.isPhysical) return;
    void persist({ ...box, isPhysical });
  };

  // Replace (or insert) this field's value in the box's customFieldValues.
  const commitField = (def: CustomField, raw: string) => {
    const current =
      box.customFieldValues.find((v) => v.customFieldId === def.id)?.value ??
      "";
    if (raw === current) return;
    const entry: CustomFieldValue = {
      customFieldId: def.id,
      customFieldName: def.name,
      customFieldType: def.type,
      value: raw,
    };
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

  // The System row borrows the dropdown editor, with the systems list as its
  // options (committed by name, mapped back to a systemId on persist).
  const systemOptions: CustomFieldOption[] = systems.map((s, i) => ({
    id: s.id,
    customFieldId: -1,
    name: s.name,
    isDefault: false,
    order: i,
  }));

  // Title + System + Physical first, then the custom fields in their defined
  // order. Collection is rendered separately below — it's backend-derived
  // (a box becomes a collection by holding multiple games), so it gets a
  // read-only badge instead of an editor.
  const rows: Row[] = [
    { key: "title", name: "Title", kind: "text", value: box.title, standard: true, onCommit: commitTitle },
    { key: "system", name: "System", kind: "dropdown", value: box.system?.name ?? "", options: systemOptions, standard: true, onCommit: commitSystem },
    { key: "physical", name: "Physical", kind: "boolean", value: box.isPhysical ? "true" : "false", standard: true, onCommit: commitPhysical },
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

  const games = box.videoGames ?? [];

  return (
    <>
      <Header
        icon={<VideoGameBoxIcon />}
        title="VIDEO GAME BOX"
        tagline={`${box.title} · ${box.system?.name ?? ""}`}
      />

      <main className={styles.main}>
        <div className={styles.wrap}>
          <div className={styles.topbar}>
            <Button href="/video-games?view=shelf" className={styles.backbtn}>
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

            {/* Collection is derived by the backend from the box's game count,
                so it shows a static badge rather than an editor. */}
            <div className={styles.row}>
              <div className={styles.rowlabel}>
                <span
                  className={styles.glyph}
                  style={{
                    background: STANDARD_FIELD_META.bg,
                    color: STANDARD_FIELD_META.fg,
                  }}
                >
                  <StandardFieldGlyph size={15} />
                </span>
                <span className={styles.lblwrap}>
                  <div className={styles.lbl}>Collection</div>
                  <div className={styles.lblkind}>Derived</div>
                </span>
              </div>
              <div className={styles.rowval}>
                <BooleanBadge value={box.isCollection} />
              </div>
            </div>
          </div>

          {/* The games inside this box, each linking to its detail page. The
              membership itself is read-only here for now. */}
          <div className={styles.card}>
            <div className={styles.caphdr}>
              <span className={styles.caphdrTitle}>Video Games</span>
              <span className={styles.caphdrCount}>
                <b>{games.length}</b> {games.length === 1 ? "game" : "games"}
              </span>
            </div>
            {games.length === 0 ? (
              <div className={styles.row}>
                <span className={styles.vText}>No games yet.</span>
              </div>
            ) : (
              <ul aria-label="Video games" className={localStyles.boxList}>
                {games.map((game) => (
                  <li className={styles.row} key={game.id}>
                    <Link
                      href={`/video-games/${game.id}`}
                      className={styles.vText}
                    >
                      {game.title}
                    </Link>
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
