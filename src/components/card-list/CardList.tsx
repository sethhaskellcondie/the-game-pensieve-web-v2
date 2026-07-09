"use client";

import Link from "next/link";
import { CheckIcon, XIcon } from "@/components/custom-fields/icons";
import type { CardBar, CardGlyph, CardPill, PillTone } from "./cardFields";
import styles from "./CardList.module.css";

// What one card shows. `title` is required; every other slot renders only
// when present, so entities with few fields get compact cards.
export type CardData = {
  title: string;
  // Secondary standard fields, pre-joined by the manager (e.g. "NES · 2 games").
  subtitle?: string;
  // Corner yes/no badge — the full labelled pill (the first boolean custom
  // field; video game boxes always show Physical here, by decision).
  glyph?: CardGlyph | null;
  // One row per progress field: stage label + n/m + a real bar.
  bars?: CardBar[];
  // The single pill row (standard booleans first, then custom fields). It
  // clips at the card edge — the detail page always has the full record.
  pills?: CardPill[];
};

export type CardListProps<Row> = {
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  loading: boolean;
  emptyMessage: string;
  loadingMessage: string;
  // Where a card navigates. The whole card is the tap target (a stretched
  // link, like the home dashboard cards) — cards are read/navigate-only by
  // decision: no delete action, no inline editors, whatever the mass-edit
  // setting says.
  getHref: (row: Row) => string;
  card: (row: Row) => CardData;
  // Whether value pills and bar rows prefix their custom field's name
  // ("Genre: Action" instead of "Action"). Owned by the manager and toggled
  // from the FilterBar's "Show field names" button. Boolean badges always
  // carry their name regardless.
  showNames: boolean;
};

const TONE_CLASS: Record<PillTone, string> = {
  gold: styles.pillGold,
  red: styles.pillRed,
  purple: styles.pillPurple,
  blue: styles.pillBlue,
};

// The DataTable's mobile twin: one
// roomy tappable card per row instead of a wide scrolling table. Purely
// presentational — the manager supplies the same rows it gives the table plus
// a `card` accessor describing what each card face shows.
export default function CardList<Row>({
  rows,
  getRowKey,
  loading,
  emptyMessage,
  loadingMessage,
  getHref,
  card,
  showNames,
}: CardListProps<Row>) {
  return (
    <div className={styles.wrap}>
      {rows.length === 0 ? (
        <p className={styles.empty}>{loading ? loadingMessage : emptyMessage}</p>
      ) : (
      <ul className={styles.list}>
        {rows.map((row) => {
          const data = card(row);
          const bars = data.bars ?? [];
          const pills = data.pills ?? [];
          return (
            <li key={getRowKey(row)} className={styles.card}>
              <div className={styles.head}>
                {/* Stretched over the whole card via CSS, so the card is the
                    tap target and the title is the link's accessible name. */}
                <Link href={getHref(row)} className={styles.title}>
                  {data.title}
                </Link>
                {data.glyph && (
                  <span
                    className={`${styles.pill} ${styles.glyph} ${
                      data.glyph.on ? styles.pillYes : styles.pillNo
                    }`}
                    role="img"
                    aria-label={`${data.glyph.label}: ${data.glyph.on ? "Yes" : "No"}`}
                  >
                    <span aria-hidden="true">{data.glyph.label}</span>
                    {data.glyph.on ? (
                      <CheckIcon aria-hidden="true" />
                    ) : (
                      <XIcon aria-hidden="true" />
                    )}
                  </span>
                )}
              </div>
              {data.subtitle && (
                <p className={styles.subtitle}>{data.subtitle}</p>
              )}
              {bars.map((bar) => (
                <div
                  key={bar.key}
                  className={styles.bar}
                  role="img"
                  aria-label={`${bar.name}: ${bar.stage} (${bar.pos} of ${bar.count})`}
                >
                  <span className={styles.barHead} aria-hidden="true">
                    <span className={styles.barStage}>
                      {showNames ? `${bar.name}: ${bar.stage}` : bar.stage}
                    </span>
                    <span className={styles.barCount}>
                      {bar.pos}/{bar.count}
                    </span>
                  </span>
                  <span className={styles.barTrack} aria-hidden="true">
                    <span
                      className={`${styles.barFill}${
                        bar.pos >= bar.count ? ` ${styles.barFillDone}` : ""
                      }`}
                      style={{
                        width: `${Math.round((bar.pos / Math.max(1, bar.count)) * 100)}%`,
                      }}
                    />
                  </span>
                </div>
              ))}
              {pills.length > 0 && (
                <ul className={styles.pills}>
                  {pills.map((pill) =>
                    pill.kind === "boolean" ? (
                      <li
                        key={pill.key}
                        className={`${styles.pill} ${
                          pill.on ? styles.pillYes : styles.pillNo
                        }`}
                        role="img"
                        aria-label={`${pill.label}: ${pill.on ? "Yes" : "No"}`}
                      >
                        <span aria-hidden="true">{pill.label}</span>
                        {pill.on ? (
                          <CheckIcon aria-hidden="true" />
                        ) : (
                          <XIcon aria-hidden="true" />
                        )}
                      </li>
                    ) : (
                      <li
                        key={pill.key}
                        className={`${styles.pill} ${TONE_CLASS[pill.tone]}`}
                      >
                        {showNames ? `${pill.name}: ${pill.label}` : pill.label}
                      </li>
                    ),
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      )}
    </div>
  );
}
