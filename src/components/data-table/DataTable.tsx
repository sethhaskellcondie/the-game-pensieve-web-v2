"use client";

import { useState, type ReactNode } from "react";
import { ChevronRightIcon, TrashIcon } from "@/components/custom-fields/icons";
import styles from "./DataTable.module.css";

// A single column definition. `render` turns a row into the cell's content, so
// the table itself stays presentational and knows nothing about the row shape.
export type ColumnDef<Row> = {
  key: string;
  label: string;
  width: number;
  min?: number;
  frozen?: boolean;
  seam?: boolean;
  render: (row: Row) => ReactNode;
};

export type DataTableProps<Row> = {
  columns: ColumnDef<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  loading: boolean;
  emptyMessage: string;
  loadingMessage: string;
  // Omit to render no delete column at all.
  onDelete?: (row: Row) => void;
  // aria-label for a row's delete button.
  deleteLabel?: (row: Row) => string;
  // Omit to render no leading "open details" column at all. When present, a
  // frozen first column with a small chevron button is added.
  onOpenDetails?: (row: Row) => void;
  // aria-label for a row's open-details button.
  detailsLabel?: (row: Row) => string;
};

const MIN_COL = 110;
const MAX_COL = 560;
// Fixed width for the delete column. It must be a real <col> width because
// table-layout: fixed honors those but ignores a cell's min-width — without it
// the auto delete column collapses to 0 (hiding the buttons and blanking its
// header) whenever the table overflows. A trailing auto filler column absorbs
// the leftover space instead, so the data columns never stretch.
const DEL_W = 56;
// Fixed width for the leading open-details column — same rationale as DEL_W.
const DETAIL_W = 52;

// Column resize lives at module scope so it can imperatively drive
// document.body during the drag without tripping the in-component
// immutability rules. setWidths is the state setter passed in by the caller.
function beginColumnResize(
  key: string,
  e: React.MouseEvent,
  startW: number,
  minW: number,
  setWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>,
) {
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";
  const onMove = (ev: MouseEvent) =>
    setWidths((ws) => ({
      ...ws,
      [key]: Math.max(
        minW,
        Math.min(MAX_COL, Math.round(startW + (ev.clientX - startX))),
      ),
    }));
  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

export default function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  loading,
  emptyMessage,
  loadingMessage,
  onDelete,
  deleteLabel,
  onOpenDetails,
  detailsLabel,
}: DataTableProps<Row>) {
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((c) => [c.key, c.width])),
  );

  // Drag a header's right edge to resize that column (spreadsheet feel). Each
  // column may set its own resize floor.
  const startResize = (key: string, e: React.MouseEvent) => {
    const col = columns.find((c) => c.key === key);
    const minW = col?.min ?? MIN_COL;
    const startW = widths[key] ?? col?.width ?? minW;
    beginColumnResize(key, e, startW, minW, setWidths);
  };

  // Cumulative left offset for each frozen (sticky) column. The leading
  // details column (when present) is itself frozen at left:0 and so pushes the
  // first data column's sticky offset over by its width.
  const frozenLeft: Record<string, number> = (() => {
    let acc = onOpenDetails ? DETAIL_W : 0;
    const m: Record<string, number> = {};
    for (const c of columns) {
      if (c.frozen) {
        m[c.key] = acc;
        acc += widths[c.key] ?? c.width;
      }
    }
    return m;
  })();

  const colSpan =
    columns.length + (onOpenDetails ? 1 : 0) + (onDelete ? 1 : 0) + 1;

  return (
    <div className={styles.card}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <colgroup>
            {onOpenDetails && <col style={{ width: DETAIL_W }} />}
            {columns.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] ?? c.width }} />
            ))}
            {onDelete && <col style={{ width: DEL_W }} />}
            <col />
          </colgroup>
          <thead>
            <tr>
              {onOpenDetails && (
                <th
                  scope="col"
                  className={`${styles.detailCol} ${styles.frozen}`}
                  style={{ left: 0 }}
                  aria-label="Details"
                />
              )}
              {columns.map((c) => {
                const cls = [
                  styles.hcell,
                  c.frozen ? styles.frozen : "",
                  c.seam ? styles.seam : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={cls}
                    style={c.frozen ? { left: frozenLeft[c.key] } : undefined}
                  >
                    <div className={styles.thLabel}>{c.label}</div>
                    <span
                      className={styles.resize}
                      title="Drag to resize"
                      onMouseDown={(e) => startResize(c.key, e)}
                    />
                  </th>
                );
              })}
              {onDelete && (
                <th scope="col" className={styles.delCol} aria-label="Delete" />
              )}
              <th aria-hidden="true" className={styles.filler} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getRowKey(row)} className={styles.row}>
                {onOpenDetails && (
                  <td
                    className={`${styles.detailCol} ${styles.frozen}`}
                    style={{ left: 0 }}
                  >
                    <button
                      type="button"
                      className={styles.detail}
                      aria-label={detailsLabel?.(row) ?? "View details"}
                      onClick={() => onOpenDetails(row)}
                    >
                      <ChevronRightIcon />
                    </button>
                  </td>
                )}
                {columns.map((c) => {
                  const cls = [
                    styles.cell,
                    c.frozen ? styles.frozen : "",
                    c.seam ? styles.seam : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <td
                      key={c.key}
                      className={cls}
                      style={c.frozen ? { left: frozenLeft[c.key] } : undefined}
                    >
                      {c.render(row)}
                    </td>
                  );
                })}
                {onDelete && (
                  <td className={styles.delCol}>
                    <button
                      type="button"
                      className={styles.del}
                      aria-label={deleteLabel?.(row) ?? "Delete"}
                      onClick={() => onDelete(row)}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                )}
                <td className={styles.filler} />
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td className={styles.emptyState} colSpan={colSpan}>
                  {emptyMessage}
                </td>
              </tr>
            )}
            {loading && rows.length === 0 && (
              <tr>
                <td className={styles.emptyState} colSpan={colSpan}>
                  {loadingMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
