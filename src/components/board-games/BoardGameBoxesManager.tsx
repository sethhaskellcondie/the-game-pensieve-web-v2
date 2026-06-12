"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BoardGameBox,
  CreateBoardGameBoxInput,
  CustomField,
  CustomFieldType,
  CustomFieldValue as CustomFieldValueType,
  FilterSpecification,
  UpdateBoardGameBoxInput,
} from "@/lib/api";
import Button from "@/components/Button";
import DataTable, {
  MIN_COL,
  type ColumnDef,
} from "@/components/data-table/DataTable";
import { PlusIcon } from "@/components/custom-fields/icons";
import { useToast } from "@/components/ToastProvider";
import { useUiSettings } from "@/components/UiSettingsProvider";
import FilterBar from "@/components/filters/FilterBar";
import {
  fetchDefaultSortOptions,
  resolveDefaultSorts,
  sortsOrDefault,
} from "@/components/filters/defaultSorts";
import { buildFieldList, supportsSorting } from "@/components/filters/fieldList";
import { toFilterRequest, toSortRequest } from "@/components/filters/serialize";
import type { ActiveFilter, ActiveSort } from "@/components/filters/types";
import CustomFieldValue from "@/components/toys/CustomFieldValue";
import FieldEditor, {
  normalizeFieldValue,
} from "@/components/toys/toyFieldEditors";
import styles from "@/components/toys/ToysManager.module.css";
import BoardGameBoxCreateModal from "./BoardGameBoxCreateModal";
import {
  fetchEntityFields,
  fetchFilterSpec,
  readJson,
  searchBoardGameBoxesClient,
} from "./searchClient";

// Self-contained inline editor for the Title column: holds its own draft so a
// keystroke re-renders only this input, not the whole table. Commits on
// Enter/blur, cancels on Escape. A latch keeps the Enter-then-blur sequence
// from committing twice.
function InlineEditInput({
  initial,
  ariaLabel,
  onCommit,
  onCancel,
}: {
  initial: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const commit = () => {
    if (done.current) return;
    done.current = true;
    onCommit(value);
  };
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    onCancel();
  };
  return (
    <input
      className={styles.editInput}
      aria-label={ariaLabel}
      value={value}
      autoFocus
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      onBlur={commit}
    />
  );
}

// One mass-edit-mode cell for the Title column: the value as a click-to-edit
// trigger, or the inline input while this cell is the one being edited.
function EditableTitleCell({
  box,
  editing,
  onStart,
  onCommit,
  onCancel,
}: {
  box: BoardGameBox;
  editing: boolean;
  onStart: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  if (editing) {
    return (
      <InlineEditInput
        initial={box.title}
        ariaLabel={`Title for ${box.title}`}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
  }
  return (
    <button type="button" className={styles.editTrigger} onClick={onStart}>
      {box.title || <span className={styles.dash}>—</span>}
    </button>
  );
}

function loadErrorMessage(error: unknown): string {
  return error instanceof Error
    ? `Couldn't load board game boxes: ${error.message}`
    : "Couldn't load board game boxes. Please try again.";
}

// The shelf view of the board games page: the same table treatment as the
// list view, but each row is a board game box (a base set, an extra copy, or
// an expansion) searched through the boardGameBox endpoints.
export default function BoardGameBoxesManager() {
  const router = useRouter();
  const { showToast, showSnackbar } = useToast();
  const { settings } = useUiSettings();
  const massEditMode = settings.massEditMode;
  const standardFields = settings.standardFields.boardGameBox;
  const [boxes, setBoxes] = useState<BoardGameBox[]>([]);
  // The unfiltered box list from the mount load. Search responses carry only
  // baseSetId, so the Base Set column resolves titles against this list — a
  // filtered view's base set may not be among the filtered rows. Kept in step
  // with creates/edits/deletes below.
  const [allBoxes, setAllBoxes] = useState<BoardGameBox[]>([]);
  const [definitions, setDefinitions] = useState<CustomField[]>([]);
  // The boardGame entity's custom fields — the create dialog's stacked
  // add-a-game form needs them.
  const [gameDefinitions, setGameDefinitions] = useState<CustomField[]>([]);
  const [spec, setSpec] = useState<FilterSpecification | null>(null);
  const [loading, setLoading] = useState(true);
  // Create-box dialog state: open flag + in-flight guard for its save button.
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  // The quick-search text (folded into a title-contains filter) and the explicit
  // filter chips. Both feed the server-side search.
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  // The sort levels the user entered on this page (the Sort button's state).
  // Starts empty even when a default sort is stored — the default never shows
  // here; it is folded into the search request only while this is empty. The
  // button renders only when the spec advertises sorting (its "all_fields"
  // capability marker).
  const [sorts, setSorts] = useState<ActiveSort[]>([]);
  // The stored default sort, resolved against the field list at mount. Every
  // search without page sorts (initial load, and after "Clear sorting") sends
  // these instead; any page sort wins outright.
  const [defaultSorts, setDefaultSorts] = useState<ActiveSort[]>([]);
  const canSort = useMemo(() => supportsSorting(spec), [spec]);
  // The row whose Title cell is being inline-edited, or null when idle.
  const [editingId, setEditingId] = useState<number | null>(null);

  // The unified field list (standard spec fields + custom fields) the filter
  // bar offers. Board game boxes have no relationship filters, so no remapping.
  const fieldDefs = useMemo(
    () => buildFieldList(spec, definitions),
    [spec, definitions],
  );

  const baseSetTitleById = useMemo(
    () => new Map(allBoxes.map((b) => [b.id, b.title])),
    [allBoxes],
  );

  // The last search payload sent (and a sequence counter for last-write-wins),
  // shared by the mount load and the search effect below so neither repeats
  // the other's query.
  const lastDto = useRef("[]");
  const searchSeq = useRef(0);

  // Load the field definitions for both entities, the filter spec, and the
  // stored default sort options together on mount, then run the initial
  // search with the resolved defaults so the first page of results already
  // honors them. The defaults stay out of the Sort button's state — they only
  // ever ride along in the request while the page has no sorts of its own.
  // setState lives in the promise callbacks (not the effect body); `active`
  // drops a stale response if the component unmounts before the requests
  // resolve.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      fetchEntityFields("boardGameBox", controller.signal),
      fetchEntityFields("boardGame", controller.signal),
      fetchFilterSpec("boardGameBox", controller.signal),
      fetchDefaultSortOptions(controller.signal),
    ])
      .then(async ([loadedDefs, loadedGameDefs, loadedSpec, defaultSortOptions]) => {
        // Resolve the stored levels against the live field list (dropping any
        // field that no longer exists), and only when the spec advertises
        // sorting at all. lastDto is primed with the seeded payload so the
        // search effect below doesn't immediately re-run the same query.
        const seeded = supportsSorting(loadedSpec)
          ? resolveDefaultSorts(
              defaultSortOptions.boardGameBox,
              buildFieldList(loadedSpec, loadedDefs),
            )
          : [];
        const dto = toSortRequest("boardGameBox", seeded);
        lastDto.current = JSON.stringify(dto);
        const loadedBoxes = await searchBoardGameBoxesClient(
          dto,
          controller.signal,
        );
        if (!active) return;
        setBoxes(loadedBoxes);
        setAllBoxes(loadedBoxes);
        setDefinitions(loadedDefs);
        setGameDefinitions(loadedGameDefs);
        setSpec(loadedSpec);
        setDefaultSorts(seeded);
        setLoading(false);
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        console.error("Load board game boxes failed", error);
        setBoxes([]);
        setAllBoxes([]);
        setDefinitions([]);
        setGameDefinitions([]);
        setLoading(false);
        showSnackbar({ message: loadErrorMessage(error), variant: "error" });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [showSnackbar]);

  // Re-run the server search whenever the filter chips or sort levels change.
  // The sort filters sent are the page's own levels, or the stored defaults
  // while the page has none (so "Clear sorting" returns to the default sort).
  // Debounced so rapid edits coalesce, abortable so an in-flight request is
  // cancelled, and seq-guarded so only the newest response is committed
  // (last-write-wins). A run whose payload matches the last one sent is
  // skipped — that covers the initial mount (the mount effect already loaded).
  // The search box doesn't filter live — it adds a title-contains chip on
  // Enter, which flows through here. Only the visible rows change; allBoxes
  // keeps the full list for Base Set resolution.
  useEffect(() => {
    const dto = [
      ...toFilterRequest("boardGameBox", filters),
      ...toSortRequest("boardGameBox", sortsOrDefault(sorts, defaultSorts)),
    ];
    const dtoJson = JSON.stringify(dto);
    if (dtoJson === lastDto.current) return;
    lastDto.current = dtoJson;
    const controller = new AbortController();
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      searchBoardGameBoxesClient(dto, controller.signal)
        .then((rows) => {
          if (seq === searchSeq.current) setBoxes(rows);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.error("Search board game boxes failed", error);
          showSnackbar({ message: loadErrorMessage(error), variant: "error" });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, sorts, defaultSorts, showSnackbar]);

  // Apply `next` optimistically (to the visible rows and the resolution list)
  // and PUT the whole box — the backend's BoardGameBoxUpdateRequest requires
  // every field, including the linked game's id. Every inline commit below
  // funnels through here.
  const persist = useCallback(
    async (next: BoardGameBox) => {
      // Capture the pre-edit lists inside the functional updates so this
      // callback doesn't need them as dependencies.
      let prev: BoardGameBox[] = [];
      let prevAll: BoardGameBox[] = [];
      setBoxes((bs) => {
        prev = bs;
        return bs.map((b) => (b.id === next.id ? next : b));
      });
      setAllBoxes((bs) => {
        prevAll = bs;
        return bs.map((b) => (b.id === next.id ? next : b));
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
        const res = await fetch(`/api/board-game-boxes/${next.id}`, {
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
        setBoxes(prev);
        setAllBoxes(prevAll);
        showSnackbar({
          message:
            error instanceof Error
              ? `Couldn't update the board game box: ${error.message}`
              : "Couldn't update the board game box. Please try again.",
          variant: "error",
        });
      }
    },
    [showToast, showSnackbar],
  );

  // Commit an inline Title edit. Title is required, so blank (or unchanged)
  // values just exit edit mode.
  const commitTitle = useCallback(
    (box: BoardGameBox, raw: string) => {
      setEditingId(null);
      const title = raw.trim();
      if (title === "" || title === box.title) return;
      void persist({ ...box, title });
    },
    [persist],
  );

  // Turning Expansion off makes the base set meaningless, so it's cleared in
  // the same write.
  const commitExpansion = useCallback(
    (box: BoardGameBox, raw: string) => {
      const isExpansion = raw === "true";
      if (isExpansion === box.isExpansion) return;
      void persist({
        ...box,
        isExpansion,
        baseSetId: isExpansion ? box.baseSetId : null,
      });
    },
    [persist],
  );

  const commitStandAlone = useCallback(
    (box: BoardGameBox, raw: string) => {
      const isStandAlone = raw === "true";
      if (isStandAlone === box.isStandAlone) return;
      void persist({ ...box, isStandAlone });
    },
    [persist],
  );

  // Commit a custom-field value edited inline in the grid (mass-edit mode):
  // merge the value into the box's customFieldValues and persist.
  const commitFieldValue = useCallback(
    (box: BoardGameBox, def: CustomField, value: string) => {
      const current =
        box.customFieldValues.find((v) => v.customFieldId === def.id)?.value ??
        "";
      if (value === current) return;
      const entry: CustomFieldValueType = {
        customFieldId: def.id,
        customFieldName: def.name,
        customFieldType: def.type,
        value,
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
    },
    [persist],
  );

  // Title, Board Game, Expansion, Stand Alone, and Base Set are always first;
  // the rest of the columns are the box custom fields, in their defined order.
  // In mass-edit mode the Title cell becomes click-to-edit and the two flags
  // get the inline boolean editor. Board Game and Base Set stay read-only —
  // those relationships are picked by id on the detail pages, not committed by
  // name in a grid cell.
  const columns = useMemo<ColumnDef<BoardGameBox>[]>(() => {
    const base: ColumnDef<BoardGameBox>[] = [
      {
        key: "title",
        label: "Title",
        width: 272,
        frozen: true,
        seam: true,
        render: massEditMode
          ? (box) => (
              <EditableTitleCell
                box={box}
                editing={editingId === box.id}
                onStart={() => setEditingId(box.id)}
                onCommit={(value) => commitTitle(box, value)}
                onCancel={() => setEditingId(null)}
              />
            )
          : (box) => box.title,
      },
      {
        key: "boardGame",
        label: "Board Game",
        width: 200,
        render: (box) => box.boardGame?.title ?? "",
      },
      {
        key: "expansion",
        label: "Expansion",
        width: MIN_COL,
        render: massEditMode
          ? (box) => (
              <FieldEditor
                field={{
                  name: "Expansion",
                  kind: "boolean",
                  value: box.isExpansion ? "true" : "false",
                }}
                onCommit={(v) => commitExpansion(box, v)}
              />
            )
          : (box) => (
              <CustomFieldValue
                type="boolean"
                value={box.isExpansion ? "true" : "false"}
              />
            ),
      },
      {
        key: "standAlone",
        label: "Stand Alone",
        width: MIN_COL,
        render: massEditMode
          ? (box) => (
              <FieldEditor
                field={{
                  name: "Stand Alone",
                  kind: "boolean",
                  value: box.isStandAlone ? "true" : "false",
                }}
                onCommit={(v) => commitStandAlone(box, v)}
              />
            )
          : (box) => (
              <CustomFieldValue
                type="boolean"
                value={box.isStandAlone ? "true" : "false"}
              />
            ),
      },
      {
        key: "baseSet",
        label: "Base Set",
        width: 200,
        render: (box) =>
          box.baseSetId == null ? (
            <span className={styles.dash}>—</span>
          ) : (
            (baseSetTitleById.get(box.baseSetId) ?? (
              <span className={styles.dash}>—</span>
            ))
          ),
      },
    ];
    // In mass-edit mode, every custom-field cell becomes the full interactive
    // editor (the same controls as the box detail page) — committing an edit
    // persists the change. Otherwise every type shows its read-only display.
    const editableInline: CustomFieldType[] = [
      "text",
      "dropdown",
      "boolean",
      "number",
      "radio_button",
      "progress_bar",
    ];
    function renderFieldCell(box: BoardGameBox, def: CustomField) {
      const value = box.customFieldValues.find(
        (cv) => cv.customFieldId === def.id,
      )?.value;
      if (massEditMode && editableInline.includes(def.type)) {
        return (
          <FieldEditor
            field={{
              name: def.name,
              kind: def.type,
              value: normalizeFieldValue(def.type, value, def.options),
              options: [...def.options].sort((a, b) => a.order - b.order),
            }}
            onCommit={(v) => commitFieldValue(box, def, v)}
          />
        );
      }
      return (
        <CustomFieldValue type={def.type} value={value} options={def.options} />
      );
    }
    // Number and Yes/No values are narrow, so those columns default to the
    // minimum width to save space; the rest start wider.
    const dynamic: ColumnDef<BoardGameBox>[] = definitions.map((def) => ({
      key: `cf-${def.id}`,
      label: def.name,
      width: def.type === "number" || def.type === "boolean" ? MIN_COL : 180,
      render: (box) => renderFieldCell(box, def),
    }));
    // Drop the standard columns the user hid via Options → Show/Hide Standard
    // Fields. Column keys match the setting keys, and the title column has no
    // setting, so it is never hidden.
    const hidden = new Set(
      Object.entries(standardFields)
        .filter(([, shown]) => !shown)
        .map(([key]) => key),
    );
    return [...base.filter((col) => !hidden.has(col.key)), ...dynamic];
  }, [
    definitions,
    massEditMode,
    standardFields,
    editingId,
    baseSetTitleById,
    commitTitle,
    commitExpansion,
    commitStandAlone,
    commitFieldValue,
  ]);

  // Create a box from the dialog: POST it and prepend the saved box (with its
  // backend-assigned id) to both lists. Returns whether it succeeded; the
  // dialog decides what to do next (close, or reset for another entry in
  // mass-input mode). On failure it stays open so the user can retry without
  // re-entering.
  const handleCreate = useCallback(
    async (input: CreateBoardGameBoxInput): Promise<boolean> => {
      setSaving(true);
      try {
        const res = await fetch("/api/board-game-boxes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const created = await readJson<BoardGameBox>(res);
        setBoxes((bs) => [created, ...bs]);
        setAllBoxes((bs) => [created, ...bs]);
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
        setSaving(false);
      }
    },
    [showToast, showSnackbar],
  );

  // Delete a box (the grid's trash asks "Are you sure?" first — like video
  // game boxes, a game whose last box is deleted goes with it). The row only
  // leaves the grid once the backend confirms.
  const handleDelete = useCallback(
    async (box: BoardGameBox): Promise<void> => {
      try {
        const res = await fetch(`/api/board-game-boxes/${box.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(body?.message ?? "Request failed");
        }
        setBoxes((bs) => bs.filter((b) => b.id !== box.id));
        setAllBoxes((bs) => bs.filter((b) => b.id !== box.id));
        showToast({ message: "Board game box deleted.", variant: "success" });
      } catch (error) {
        console.error("Delete board game box failed", error);
        showSnackbar({
          message:
            error instanceof Error
              ? `Couldn't delete the board game box: ${error.message}`
              : "Couldn't delete the board game box. Please try again.",
          variant: "error",
        });
      }
    },
    [showToast, showSnackbar],
  );

  const hasFilters = filters.length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.titleWrap}>
          <h2 className={styles.entName}><b>{boxes.length}</b> {boxes.length === 1 ? "Board Game Box" : "Board Game Boxes"}</h2>
          {massEditMode && (
            <div className={styles.crumb}>
              <span>Mass edit mode is on.</span>
            </div>
          )}
        </div>
        <FilterBar
          entityKey="boardGameBox"
          fields={fieldDefs}
          filters={filters}
          onChange={setFilters}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search board game boxes…"
          searchAriaLabel="Search board game boxes"
          sorts={canSort ? sorts : undefined}
          onSortsChange={canSort ? setSorts : undefined}
        />
        <div className={styles.actions}>
          <Button className={styles.newBtn} onClick={() => setCreating(true)}>
            <PlusIcon /> New
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={boxes}
        getRowKey={(box) => box.id}
        loading={loading}
        loadingMessage="Loading board game boxes…"
        emptyMessage={
          hasFilters
            ? "No board game boxes match your filters."
            : "No board game boxes yet."
        }
        // Deleting a box may also delete a game left with no other box, so the
        // trash goes through the confirmDelete "Are you sure?" menu.
        onDelete={(box) => void handleDelete(box)}
        deleteLabel={(box) => `Delete ${box.title}`}
        confirmDelete
        // The leading details column only appears in mass edit mode; otherwise
        // the whole row navigates to the box's detail page. Both routes are
        // the same — they just differ in affordance per mode.
        onOpenDetails={
          massEditMode
            ? (box) => router.push(`/board-game-boxes/${box.id}`)
            : undefined
        }
        detailsLabel={(box) => `View ${box.title}`}
        onRowClick={
          massEditMode
            ? undefined
            : (box) => router.push(`/board-game-boxes/${box.id}`)
        }
        rowClickLabel={(box) => `View ${box.title}`}
      />

      {creating && (
        <BoardGameBoxCreateModal
          definitions={definitions}
          gameDefinitions={gameDefinitions}
          saving={saving}
          onCreate={handleCreate}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
