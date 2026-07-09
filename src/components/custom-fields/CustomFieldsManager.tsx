"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CustomField,
  EntityKey,
  UpdateCustomFieldInput,
} from "@/lib/api";
import Button from "@/components/Button";
import { useToast } from "@/components/ToastProvider";
import { useSession } from "@/components/auth/SessionProvider";
import { bffFetch } from "@/lib/bffClient";
import { DEFAULT_ENTITY, ENTITY_META } from "./registry";
import EntitySelect from "./EntitySelect";
import KindBadge from "./KindBadge";
import OptionList from "./OptionList";
import FieldModal, { type FieldModalSave } from "./FieldModal";
import { usePersistentColumnWidths } from "@/components/data-table/usePersistentColumnWidths";
import { useIsMobile } from "@/lib/useMediaQuery";
import {
  CaretIcon,
  GripIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "./icons";
import styles from "./CustomFieldsManager.module.css";

type ColKey = "order" | "name" | "kind" | "options";
type Column = { key: ColKey; label: string; width: number; min?: number; frozen?: boolean; seam?: boolean };

const COLS: Column[] = [
  // Order is the narrowest column (a grip + number + up/down buttons), so it
  // gets a smaller resize floor than MIN_COL — otherwise dragging it would
  // snap up past its own default width.
  { key: "order", label: "Order", width: 96, min: 56, frozen: true },
  { key: "name", label: "Name", width: 272, frozen: true, seam: true },
  { key: "kind", label: "Custom Field Type", width: 226 },
  { key: "options", label: "Options (* = default)", width: 380 },
];
const MIN_COL = 110;
const MAX_COL = 560;
// Fixed width for the delete column. It must be a real <col> width because
// table-layout: fixed honors those but ignores a cell's min-width — without it
// the auto delete column collapses to 0 (hiding the buttons and blanking its
// header) whenever the table overflows. A trailing auto filler column absorbs
// the leftover space instead, so the data columns never stretch.
const DEL_W = 56;

type ModalState = { mode: "create" | "edit"; field?: CustomField };
type OverInfo = { id: number; pos: "before" | "after" };

// Reads a route handler's response once, throwing the forwarded backend message
// on failure. Route handlers answer { status, data } or { status, message }.
// Column resize lives at module scope so it can imperatively drive
// document.body during the drag without tripping the in-component
// immutability rules. setWidths is the state setter passed in by the caller.
// Pointer events (not mouse*) so the drag also works with touch and pen; the
// pointerId guard keeps a second finger from steering someone else's drag,
// and pointercancel (e.g. the browser reclaiming the gesture) ends it cleanly.
function beginColumnResize(
  key: ColKey,
  e: React.PointerEvent,
  startW: number,
  minW: number,
  setWidths: React.Dispatch<React.SetStateAction<Record<ColKey, number>>>,
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

async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as
    | { data?: T; message?: string }
    | null;
  if (!res.ok) {
    throw new Error(body?.message ?? "Request failed");
  }
  return body?.data as T;
}

// Pure fetch (no setState), so both the load effect and event-handler refetches
// can share it. Returns the entity's fields sorted by order; throws on failure.
async function fetchFields(
  key: EntityKey,
  signal?: AbortSignal,
): Promise<CustomField[]> {
  const res = await fetch(`/api/custom-fields/entity/${key}`, { signal });
  const data = await readJson<CustomField[]>(res);
  return [...data].sort((a, b) => a.order - b.order);
}

function loadErrorMessage(error: unknown): string {
  return error instanceof Error
    ? `Couldn't load custom fields: ${error.message}`
    : "Couldn't load custom fields. Please try again.";
}

export default function CustomFieldsManager() {
  const { showToast, showSnackbar } = useToast();
  // Custom fields are owner data: only an active (Paid) account may create,
  // rename, reorder, or delete them. Guests/lapsed see the list read-only.
  const { canWrite } = useSession();
  const [entityKey, setEntityKey] = useState<EntityKey>(DEFAULT_ENTITY);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);
  // Which row's "Are you sure?" delete menu is open, and where to anchor it.
  // position:fixed (from the trash button's rect) so the table's scroll
  // container can't clip it — the same confirmation the data tables use.
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: number;
    top: number;
    right: number;
  } | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overInfo, setOverInfo] = useState<OverInfo | null>(null);
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [widths, setWidths] = usePersistentColumnWidths<ColKey>(
    "custom-fields",
    COLS,
  );
  // Below the breakpoint the table is replaced by a card per field.
  // Unlike the entity cards these stay interactive —
  // custom fields have no detail page, so reorder, delete, and edit must live
  // on the card. Conditionally mounted — never both — so the hidden twin can't
  // leak duplicate queryable content into the DOM.
  const isMobile = useIsMobile();

  // Refetch the current scope after a mutation. Runs from event handlers, so a
  // post-await setState here is fine (it's the load effect that must avoid it).
  const loadFields = useCallback(
    async (key: EntityKey) => {
      try {
        setFields(await fetchFields(key));
      } catch (error) {
        console.error("Load custom fields failed", error);
        showSnackbar({ message: loadErrorMessage(error), variant: "error" });
      }
    },
    [showSnackbar],
  );

  // Reload whenever the scoped entity changes. setState lives in the promise
  // callbacks (not the effect body); `active` drops a stale response when the
  // user switches entities before the request resolves.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchFields(entityKey, controller.signal)
      .then((data) => {
        if (!active) return;
        setFields(data);
        setLoading(false);
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        console.error("Load custom fields failed", error);
        setFields([]);
        setLoading(false);
        showSnackbar({ message: loadErrorMessage(error), variant: "error" });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [entityKey, showSnackbar]);

  // Any click elsewhere (the menu and its trigger stop propagation), Escape,
  // scroll, or resize dismisses the delete confirmation menu.
  useEffect(() => {
    if (!deleteConfirm) return;
    const close = () => setDeleteConfirm(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // The opening click focuses the trash button, and when that button sits at
    // the edge of the scroll container the browser then asynchronously scrolls
    // it fully into view — that stray scroll must not dismiss the menu it just
    // opened. Arm the scroll closer two frames later, past the focus scroll.
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
  }, [deleteConfirm]);

  const handleSave = async (payload: FieldModalSave) => {
    setSaving(true);
    try {
      const res =
        payload.mode === "create"
          ? await bffFetch("/api/custom-fields", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload.input),
            })
          : await bffFetch(`/api/custom-fields/${payload.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload.input),
            });
      await readJson<CustomField>(res);
      showToast({
        message:
          payload.mode === "create"
            ? "Custom field created."
            : "Custom field updated.",
        variant: "success",
      });
      setModal(null);
      await loadFields(entityKey);
    } catch (error) {
      console.error("Save custom field failed", error);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't save the custom field: ${error.message}`
            : "Couldn't save the custom field. Please try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (field: CustomField) => {
    // Delete is applied optimistically, then resync on failure.
    setFields((fs) => fs.filter((f) => f.id !== field.id));
    try {
      const res = await bffFetch(`/api/custom-fields/${field.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "Request failed");
      }
      showToast({ message: "Custom field deleted.", variant: "success" });
    } catch (error) {
      console.error("Delete custom field failed", error);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't delete the custom field: ${error.message}`
            : "Couldn't delete the custom field. Please try again.",
        variant: "error",
      });
      await loadFields(entityKey);
    }
  };

  const startEditName = (field: CustomField) => {
    setEditingNameId(field.id);
    setDraftName(field.name);
  };

  const cancelEditName = () => {
    setEditingNameId(null);
    setDraftName("");
  };

  // Commit the inline name edit. No-ops (blank or unchanged) just exit edit
  // mode. Otherwise the rename is applied optimistically and rolled back on
  // failure. The PUT carries name + order only, leaving options untouched (see
  // persistReorder), so renaming an option-bearing field keeps its options.
  const commitEditName = async (field: CustomField) => {
    const name = draftName.trim();
    setEditingNameId(null);
    setDraftName("");
    if (name === "" || name === field.name) return;
    const prev = fields;
    setFields((fs) => fs.map((f) => (f.id === field.id ? { ...f, name } : f)));
    try {
      const input: UpdateCustomFieldInput = { name, order: field.order };
      const res = await bffFetch(`/api/custom-fields/${field.id}`, {
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
      showToast({ message: "Custom field updated.", variant: "success" });
    } catch (error) {
      console.error("Rename custom field failed", error);
      setFields(prev);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't rename the custom field: ${error.message}`
            : "Couldn't rename the custom field. Please try again.",
        variant: "error",
      });
    }
  };

  // Persist only the rows whose order changed; the backend has no reorder
  // endpoint, so each is a PUT carrying its new order (options left untouched).
  const persistReorder = async (next: CustomField[], prev: CustomField[]) => {
    const prevOrder = new Map(prev.map((f) => [f.id, f.order]));
    const changed = next.filter((f) => prevOrder.get(f.id) !== f.order);
    if (changed.length === 0) return;
    const results = await Promise.allSettled(
      changed.map((f) => {
        const input: UpdateCustomFieldInput = { name: f.name, order: f.order };
        return bffFetch(`/api/custom-fields/${f.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }).then(async (r) => {
          if (!r.ok) throw new Error("Request failed");
        });
      }),
    );
    if (results.some((r) => r.status === "rejected")) {
      showSnackbar({
        message: "Couldn't save the new order. Reloading…",
        variant: "error",
      });
      await loadFields(entityKey);
    }
  };

  const dropRow = (targetId: number) => {
    if (dragId == null || dragId === targetId) {
      setDragId(null);
      setOverInfo(null);
      return;
    }
    const prev = fields;
    const arr = [...prev];
    const from = arr.findIndex((f) => f.id === dragId);
    if (from < 0) {
      setDragId(null);
      setOverInfo(null);
      return;
    }
    const [moved] = arr.splice(from, 1);
    let to = arr.findIndex((f) => f.id === targetId);
    if (to < 0) {
      setDragId(null);
      setOverInfo(null);
      return;
    }
    if (overInfo && overInfo.pos === "after") to += 1;
    arr.splice(to, 0, moved);
    // Renumber to 0-based positions so the new order persists.
    const next = arr.map((f, idx) => ({ ...f, order: idx }));
    setFields(next);
    setDragId(null);
    setOverInfo(null);
    void persistReorder(next, prev);
  };

  // Open/close a field's "Are you sure?" delete menu, anchored to the trash
  // button that was pressed (shared by the table rows and the mobile cards).
  const toggleDeleteConfirm = (
    field: CustomField,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    if (deleteConfirm?.id === field.id) {
      setDeleteConfirm(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setDeleteConfirm({
      id: field.id,
      top: r.bottom + 7,
      right: window.innerWidth - r.right,
    });
  };

  // Swap a row with its neighbor — the tap/keyboard alternative to dragging
  // (HTML5 drag never fires on touch). Renumbers and persists exactly like a
  // drop, through persistReorder.
  const moveField = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    const prev = fields;
    const arr = [...prev];
    [arr[index], arr[target]] = [arr[target], arr[index]];
    const next = arr.map((f, idx) => ({ ...f, order: idx }));
    setFields(next);
    void persistReorder(next, prev);
  };

  // Drag a header's right edge to resize that column (spreadsheet feel). Each
  // column may set its own resize floor (Order's is below MIN_COL).
  const startResize = (key: ColKey, e: React.PointerEvent) => {
    const minW = COLS.find((c) => c.key === key)?.min ?? MIN_COL;
    beginColumnResize(key, e, widths[key], minW, setWidths);
  };

  // Cumulative left offset for each frozen (sticky) column.
  const frozenLeft: Partial<Record<ColKey, number>> = (() => {
    let acc = 0;
    const m: Partial<Record<ColKey, number>> = {};
    for (const c of COLS) {
      if (c.frozen) {
        m[c.key] = acc;
        acc += widths[c.key];
      }
    }
    return m;
  })();

  // Switching scope is a user event, so the loading flag is set here (not in the
  // fetch effect, which only calls setState after awaiting).
  const handleEntityChange = (key: EntityKey) => {
    if (key === entityKey) return;
    setLoading(true);
    setFields([]);
    cancelEditName();
    setDeleteConfirm(null);
    setEntityKey(key);
  };

  const entityLabel = ENTITY_META[entityKey].label;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.titleWrap}>
          <h2 className={styles.entName}>{entityLabel}</h2>
          <div className={styles.crumb}>
            <span>
              {loading ? (
                "Loading…"
              ) : (
                <>
                  <b>{fields.length}</b> {fields.length === 1 ? "field" : "fields"}
                </>
              )}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <EntitySelect
            className={styles.entityScope}
            value={entityKey}
            onChange={handleEntityChange}
          />
          {/* Creating fields is a write — hidden for guests/lapsed. */}
          {canWrite && (
            <Button
              className={styles.newBtn}
              onClick={() => setModal({ mode: "create" })}
            >
              <PlusIcon /> New
            </Button>
          )}
        </div>
      </div>

      {isMobile ? (
        <ul className={styles.cards} aria-label="Custom fields">
          {fields.map((field, i) => (
            <li key={field.id} className={styles.fieldCard}>
              <div className={styles.fieldCardHead}>
                <span className={styles.cardOrderNum}>{i + 1}</span>
                {/* Renaming reuses the table's inline editor state; the
                    pencil is always visible — touch has no hover to reveal
                    the affordance. Guests see the name as plain text. */}
                {editingNameId === field.id ? (
                  <input
                    className={styles.cardNameInput}
                    aria-label={`Name for ${field.name}`}
                    value={draftName}
                    autoFocus
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void commitEditName(field);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEditName();
                      }
                    }}
                    onBlur={() => void commitEditName(field)}
                  />
                ) : canWrite ? (
                  <button
                    type="button"
                    className={styles.cardNameBtn}
                    onClick={() => startEditName(field)}
                  >
                    <span className={styles.cardName}>{field.name}</span>
                    <PencilIcon aria-hidden="true" />
                  </button>
                ) : (
                  <span className={styles.cardName}>{field.name}</span>
                )}
                {/* Reordering and deleting are writes — hidden for
                    guests/lapsed, like the table's controls. */}
                {canWrite && (
                  <>
                    <button
                      type="button"
                      className={styles.cardMoveBtn}
                      aria-label={`Move ${field.name} up`}
                      disabled={i === 0}
                      onClick={() => moveField(i, -1)}
                    >
                      <CaretIcon className={styles.caretUp} />
                    </button>
                    <button
                      type="button"
                      className={styles.cardMoveBtn}
                      aria-label={`Move ${field.name} down`}
                      disabled={i === fields.length - 1}
                      onClick={() => moveField(i, 1)}
                    >
                      <CaretIcon />
                    </button>
                    <button
                      type="button"
                      className={styles.cardDel}
                      aria-label={`Delete ${field.name}`}
                      aria-haspopup="menu"
                      aria-expanded={deleteConfirm?.id === field.id}
                      onClick={(e) => toggleDeleteConfirm(field, e)}
                    >
                      <TrashIcon />
                    </button>
                    {deleteConfirm?.id === field.id && (
                      <div
                        role="menu"
                        aria-label={`Delete ${field.name}?`}
                        className={styles.confirm}
                        style={{
                          top: deleteConfirm.top,
                          right: deleteConfirm.right,
                        }}
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
                            setDeleteConfirm(null);
                            void handleDelete(field);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* The type + options body is the tap-to-edit target, opening
                  the same modal as the desktop options cell (which also
                  covers renaming — the card has no inline name editor). An
                  option-less field shows just its type badge — no "N/A"
                  filler (that's a table-column convention). */}
              {canWrite ? (
                <button
                  type="button"
                  className={styles.cardEdit}
                  aria-label={`Edit ${field.name}`}
                  onClick={() => setModal({ mode: "edit", field })}
                >
                  <KindBadge type={field.type} />
                  {field.options.length > 0 && (
                    <OptionList options={field.options} />
                  )}
                </button>
              ) : (
                <div className={styles.cardMeta}>
                  <KindBadge type={field.type} />
                  {field.options.length > 0 && (
                    <OptionList options={field.options} />
                  )}
                </div>
              )}
            </li>
          ))}
          {fields.length === 0 && (
            <li className={styles.cardsEmpty}>
              {loading
                ? "Loading custom fields…"
                : "No custom fields for this record type."}
            </li>
          )}
        </ul>
      ) : (
      <div className={styles.card}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <colgroup>
              {COLS.map((c) => (
                <col key={c.key} style={{ width: widths[c.key] }} />
              ))}
              <col style={{ width: DEL_W }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                {COLS.map((c) => {
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
                <th scope="col" className={styles.delCol} aria-label="Delete" />
                <th aria-hidden="true" className={styles.filler} />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, i) => {
                const dropCls =
                  overInfo &&
                  overInfo.id === field.id &&
                  dragId != null &&
                  dragId !== field.id
                    ? overInfo.pos === "before"
                      ? ` ${styles.dropBefore}`
                      : ` ${styles.dropAfter}`
                    : "";
                return (
                  <tr
                    key={field.id}
                    className={`${styles.row}${dragId === field.id ? ` ${styles.dragging}` : ""}${dropCls}`}
                    onDragOver={(e) => {
                      if (dragId == null) return;
                      e.preventDefault();
                      const rc = e.currentTarget.getBoundingClientRect();
                      setOverInfo({
                        id: field.id,
                        pos:
                          e.clientY - rc.top < rc.height / 2
                            ? "before"
                            : "after",
                      });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      dropRow(field.id);
                    }}
                  >
                    <td
                      className={`${styles.cell} ${styles.frozen} ${styles.orderCell}${
                        canWrite ? "" : ` ${styles.orderCellStatic}`
                      }`}
                      style={{ left: frozenLeft.order }}
                      // Reordering is a write — only draggable for Paid users.
                      draggable={canWrite}
                      onDragStart={
                        canWrite
                          ? (e) => {
                              setDragId(field.id);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData(
                                "text/plain",
                                String(field.id),
                              );
                              const tr = e.currentTarget.closest("tr");
                              if (tr) e.dataTransfer.setDragImage(tr, 24, 18);
                            }
                          : undefined
                      }
                      onDragEnd={
                        canWrite
                          ? () => {
                              setDragId(null);
                              setOverInfo(null);
                            }
                          : undefined
                      }
                    >
                      <span className={styles.orderWrap}>
                        {/* The drag handle only appears when reordering is allowed. */}
                        {canWrite && (
                          <span
                            className={styles.grip}
                            aria-label={`Reorder ${field.name}`}
                          >
                            <GripIcon />
                          </span>
                        )}
                        <span className={styles.orderNum}>{i + 1}</span>
                        {/* Up/down buttons: the reorder path for touch (where
                            HTML5 drag never fires) and keyboard users. */}
                        {canWrite && (
                          <span className={styles.moveBtns}>
                            <button
                              type="button"
                              className={styles.moveBtn}
                              aria-label={`Move ${field.name} up`}
                              disabled={i === 0}
                              onClick={() => moveField(i, -1)}
                            >
                              <CaretIcon className={styles.caretUp} />
                            </button>
                            <button
                              type="button"
                              className={styles.moveBtn}
                              aria-label={`Move ${field.name} down`}
                              disabled={i === fields.length - 1}
                              onClick={() => moveField(i, 1)}
                            >
                              <CaretIcon />
                            </button>
                          </span>
                        )}
                      </span>
                    </td>
                    <td
                      className={`${styles.nameCell} ${styles.frozen} ${styles.seam}`}
                      style={{ left: frozenLeft.name }}
                    >
                      {/* Renaming is a write: Paid users get the click-to-edit
                          input; guests/lapsed see the name as plain text. */}
                      {editingNameId === field.id ? (
                        <input
                          className={styles.nameInput}
                          aria-label={`Name for ${field.name}`}
                          value={draftName}
                          autoFocus
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void commitEditName(field);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEditName();
                            }
                          }}
                          onBlur={() => void commitEditName(field)}
                        />
                      ) : canWrite ? (
                        <button
                          type="button"
                          className={styles.name}
                          onClick={() => startEditName(field)}
                        >
                          {field.name}
                        </button>
                      ) : (
                        <span className={styles.name}>{field.name}</span>
                      )}
                    </td>
                    <td className={styles.cell}>
                      <KindBadge type={field.type} />
                    </td>
                    <td className={`${styles.cell} ${styles.optCell}`}>
                      {/* Opening the edit modal is a write affordance: Paid
                          users get the trigger, others see options read-only. */}
                      {canWrite ? (
                        <button
                          type="button"
                          className={styles.optTrigger}
                          aria-label={`Edit ${field.name}`}
                          onClick={() => setModal({ mode: "edit", field })}
                        >
                          <OptionList options={field.options} />
                        </button>
                      ) : (
                        <OptionList options={field.options} />
                      )}
                    </td>
                    <td className={styles.delCol}>
                      {/* Deleting is a write — the control and its confirmation
                          are hidden for guests/lapsed. */}
                      {canWrite && (
                        <>
                      <button
                        type="button"
                        className={styles.del}
                        aria-label={`Delete ${field.name}`}
                        aria-haspopup="menu"
                        aria-expanded={deleteConfirm?.id === field.id}
                        onClick={(e) => toggleDeleteConfirm(field, e)}
                      >
                        <TrashIcon />
                      </button>
                      {deleteConfirm?.id === field.id && (
                        <div
                          role="menu"
                          aria-label={`Delete ${field.name}?`}
                          className={styles.confirm}
                          style={{
                            top: deleteConfirm.top,
                            right: deleteConfirm.right,
                          }}
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
                              setDeleteConfirm(null);
                              void handleDelete(field);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                        </>
                      )}
                    </td>
                    <td className={styles.filler} />
                  </tr>
                );
              })}
              {!loading && fields.length === 0 && (
                <tr>
                  <td className={styles.emptyState} colSpan={6}>
                    No custom fields for this record type.
                  </td>
                </tr>
              )}
              {loading && fields.length === 0 && (
                <tr>
                  <td className={styles.emptyState} colSpan={6}>
                    Loading custom fields…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {modal && (
        <FieldModal
          mode={modal.mode}
          field={modal.field}
          defaultEntityKey={entityKey}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
