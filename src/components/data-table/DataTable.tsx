"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronRightIcon, TrashIcon } from "@/components/custom-fields/icons";
import { usePersistentColumnWidths } from "./usePersistentColumnWidths";
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
  // When the cell content overflows a narrow column, the default is to truncate
  // it with an ellipsis ("…"). Set `clip` to hard-clip instead (no ellipsis) —
  // used for chip/editor columns (dropdown, radio, progress, system) where the
  // "…" marker is reserved for free-text columns.
  clip?: boolean;
  // Horizontal alignment of the cell content. Defaults to left; set "right" for
  // numeric columns so the values line up on their last digit.
  align?: "left" | "right";
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
  // When set, the trash button doesn't fire onDelete directly: it opens a
  // small "Are you sure?" menu (the same confirmation the box detail page
  // uses) and only the menu's Delete does.
  confirmDelete?: boolean;
  // Omit to render no leading "open details" column at all. When present, a
  // frozen first column with a small chevron button is added.
  onOpenDetails?: (row: Row) => void;
  // aria-label for a row's open-details button.
  detailsLabel?: (row: Row) => string;
  // Omit for non-interactive rows. When present, clicking (or pressing Enter on)
  // anywhere in a row that isn't another control fires this.
  onRowClick?: (row: Row) => void;
  // aria-label for a clickable row (announced when the row is focused).
  rowClickLabel?: (row: Row) => string;
  // When set, the user's column-width resizes are saved per page in the browser
  // (localStorage) under this key so they survive a refresh. Omit for no
  // persistence.
  storageKey?: string;
};

// The default per-column resize floor; also a handy default width for columns
// whose content is narrow (e.g. a number or a Yes/No badge).
export const MIN_COL = 110;
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
// Pointer events (not mouse*) so the drag also works with touch and pen; the
// pointerId guard keeps a second finger from steering someone else's drag,
// and pointercancel (e.g. the browser reclaiming the gesture) ends it cleanly.
function beginColumnResize(
  key: string,
  e: React.PointerEvent,
  startW: number,
  minW: number,
  setWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>,
) {
  e.preventDefault();
  e.stopPropagation();
  const { pointerId } = e;
  const startX = e.clientX;
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";
  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    setWidths((ws) => ({
      ...ws,
      [key]: Math.max(
        minW,
        Math.min(MAX_COL, Math.round(startW + (ev.clientX - startX))),
      ),
    }));
  };
  const onEnd = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onEnd);
    document.removeEventListener("pointercancel", onEnd);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onEnd);
  document.addEventListener("pointercancel", onEnd);
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
  confirmDelete,
  onOpenDetails,
  detailsLabel,
  onRowClick,
  rowClickLabel,
  storageKey,
}: DataTableProps<Row>) {
  const [widths, setWidths] = usePersistentColumnWidths(storageKey, columns);
  // confirmDelete state: which row's "Are you sure?" menu is open, and where.
  // The menu is position:fixed (anchored from the trash button's rect) so the
  // table's scroll container can't clip it; like the dropdown editors, any
  // scroll closes it rather than chasing the anchor.
  const [confirming, setConfirming] = useState<{
    key: string | number;
    top: number;
    right: number;
  } | null>(null);

  // Any click elsewhere (the menu and its trigger stop propagation), Escape,
  // scroll, or resize dismisses the confirmation menu.
  useEffect(() => {
    if (!confirming) return;
    const close = () => setConfirming(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // The opening click focuses the delete button, and when that button sits
    // at the edge of the scroll container the browser then asynchronously
    // scrolls it fully into view — that stray scroll must not dismiss the menu
    // it just opened. Arm the scroll closer two frames later, past the focus
    // scroll.
    let scrollArmed = false;
    const arm = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollArmed = true;
      });
    });
    const onScroll = () => {
      if (scrollArmed) close();
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      cancelAnimationFrame(arm);
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [confirming]);

  // Drag a header's right edge to resize that column (spreadsheet feel). Each
  // column may set its own resize floor.
  const startResize = (key: string, e: React.PointerEvent) => {
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
                      onPointerDown={(e) => startResize(c.key, e)}
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
              <tr
                key={getRowKey(row)}
                className={`${styles.row}${onRowClick ? ` ${styles.clickable}` : ""}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? rowClickLabel?.(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {onOpenDetails && (
                  <td
                    className={`${styles.detailCol} ${styles.frozen}`}
                    style={{ left: 0 }}
                  >
                    <button
                      type="button"
                      className={styles.detail}
                      aria-label={detailsLabel?.(row) ?? "View details"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetails(row);
                      }}
                    >
                      <ChevronRightIcon />
                    </button>
                  </td>
                )}
                {columns.map((c) => {
                  const cls = [
                    styles.cell,
                    c.clip ? styles.clip : "",
                    c.align === "right" ? styles.right : "",
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
                      aria-haspopup={confirmDelete ? "menu" : undefined}
                      aria-expanded={
                        confirmDelete
                          ? confirming?.key === getRowKey(row)
                          : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirmDelete) {
                          onDelete(row);
                          return;
                        }
                        const key = getRowKey(row);
                        if (confirming?.key === key) {
                          setConfirming(null);
                          return;
                        }
                        const r = e.currentTarget.getBoundingClientRect();
                        setConfirming({
                          key,
                          top: r.bottom + 7,
                          right: window.innerWidth - r.right,
                        });
                      }}
                    >
                      <TrashIcon />
                    </button>
                    {confirmDelete && confirming?.key === getRowKey(row) && (
                      <div
                        role="menu"
                        aria-label={`${deleteLabel?.(row) ?? "Delete"}?`}
                        className={styles.confirm}
                        style={{ top: confirming.top, right: confirming.right }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className={styles.confirmText}>
                          Are you sure?
                        </span>
                        <button
                          type="button"
                          role="menuitem"
                          className={styles.confirmDelete}
                          onClick={() => {
                            setConfirming(null);
                            onDelete(row);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
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
