"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  toCustomFieldValue,
  type BoardGame,
  type CustomField,
  type CustomFieldType,
  type CustomFieldValue as CustomFieldValueType,
  type FilterSpecification,
  type UpdateBoardGameInput,
} from "@/lib/api";
import DataTable, {
  MIN_COL,
  type ColumnDef,
} from "@/components/data-table/DataTable";
import BeginnerHint from "@/components/BeginnerHint";
import { BEGINNER_HINTS } from "@/components/beginnerHints";
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
import { decodeFilterParam } from "@/components/filters/urlFilters";
import { usePersistentFilters } from "@/components/filters/usePersistentFilters";
import type { ActiveSort } from "@/components/filters/types";
import CustomFieldValue from "@/components/toys/CustomFieldValue";
import {
  fetchEntityFields,
  fetchFilterSpec,
  searchBoardGamesClient,
} from "./searchClient";
import FieldEditor, {
  normalizeFieldValue,
} from "@/components/toys/toyFieldEditors";
import styles from "@/components/toys/ToysManager.module.css";

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
// (Boxes is a read-only count.)
function EditableTitleCell({
  game,
  editing,
  onStart,
  onCommit,
  onCancel,
}: {
  game: BoardGame;
  editing: boolean;
  onStart: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  if (editing) {
    return (
      <InlineEditInput
        initial={game.title}
        ariaLabel={`Title for ${game.title}`}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
  }
  return (
    <button type="button" className={styles.editTrigger} onClick={onStart}>
      {game.title || <span className={styles.dash}>—</span>}
    </button>
  );
}

function loadErrorMessage(error: unknown): string {
  return error instanceof Error
    ? `Couldn't load board games: ${error.message}`
    : "Couldn't load board games. Please try again.";
}

export default function BoardGamesManager({
  initialFiltersParam,
}: {
  // The `filters` URL param when opened from a home saved-filter card; seeds the
  // filter bar so the page loads already filtered. Editable/removable afterward.
  initialFiltersParam?: string | string[];
}) {
  const initialFilters = useMemo(
    () => decodeFilterParam(initialFiltersParam),
    [initialFiltersParam],
  );
  const router = useRouter();
  const { showToast, showSnackbar } = useToast();
  const { settings } = useUiSettings();
  const massEditMode = settings.massEditMode;
  const standardFields = settings.standardFields.boardGame;
  const [games, setGames] = useState<BoardGame[]>([]);
  const [definitions, setDefinitions] = useState<CustomField[]>([]);
  const [spec, setSpec] = useState<FilterSpecification | null>(null);
  const [loading, setLoading] = useState(true);
  // True while a filter/sort re-search is pending or in flight (distinct from
  // `loading`, which only covers the initial mount load). Drives the "Loading…"
  // count without blanking the table the way the DataTable `loading` prop would.
  const [searching, setSearching] = useState(false);
  // The quick-search text (folded into a title-contains filter) and the explicit
  // filter chips. Both feed the server-side search.
  const [query, setQuery] = useState("");
  const [filters, setFilters, initialResolvedFilters] = usePersistentFilters(
    "board-game",
    initialFilters,
  );
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
  // bar offers. Board games have no relationship filters, so no remapping.
  const fieldDefs = useMemo(
    () => buildFieldList(spec, definitions),
    [spec, definitions],
  );

  // The last search payload sent (and a sequence counter for last-write-wins),
  // shared by the mount load and the search effect below so neither repeats
  // the other's query.
  const lastDto = useRef(
    JSON.stringify(toFilterRequest("boardGame", initialFilters)),
  );
  const searchSeq = useRef(0);

  // Load the field definitions, the filter spec, and the stored default sort
  // options together on mount, then run the initial search with the resolved
  // defaults so the first page of results already honors them. The defaults
  // stay out of the Sort button's state — they only ever ride along in the
  // request while the page has no sorts of its own. setState lives in the
  // promise callbacks (not the effect body); `active` drops a stale response
  // if the component unmounts before the requests resolve.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      fetchEntityFields("boardGame", controller.signal),
      fetchFilterSpec("boardGame", controller.signal),
      fetchDefaultSortOptions(controller.signal),
    ])
      .then(async ([loadedDefs, loadedSpec, defaultSortOptions]) => {
        // Resolve the stored levels against the live field list (dropping any
        // field that no longer exists), and only when the spec advertises
        // sorting at all. lastDto is primed with the seeded payload so the
        // search effect below doesn't immediately re-run the same query.
        const seeded = supportsSorting(loadedSpec)
          ? resolveDefaultSorts(
              defaultSortOptions.boardGame,
              buildFieldList(loadedSpec, loadedDefs),
            )
          : [];
        const dto = [
          ...toFilterRequest("boardGame", initialResolvedFilters),
          ...toSortRequest("boardGame", seeded),
        ];
        lastDto.current = JSON.stringify(dto);
        const loadedGames = await searchBoardGamesClient(dto, controller.signal);
        if (!active) return;
        setGames(loadedGames);
        setDefinitions(loadedDefs);
        setSpec(loadedSpec);
        setDefaultSorts(seeded);
        setLoading(false);
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        console.error("Load board games failed", error);
        setGames([]);
        setDefinitions([]);
        setLoading(false);
        showSnackbar({ message: loadErrorMessage(error), variant: "error" });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [showSnackbar, initialResolvedFilters]);

  // Re-run the server search whenever the filter chips or sort levels change.
  // The sort filters sent are the page's own levels, or the stored defaults
  // while the page has none (so "Clear sorting" returns to the default sort).
  // Debounced so rapid edits coalesce, abortable so an in-flight request is
  // cancelled, and seq-guarded so only the newest response is committed
  // (last-write-wins). A run whose payload matches the last one sent is
  // skipped — that covers the initial mount (the mount effect already loaded).
  // The search box doesn't filter live — it adds a title-contains chip on
  // Enter, which flows through here.
  useEffect(() => {
    // Wait for the initial load to finish. It already queried with the resolved
    // (persisted) filters, so the post-mount restore that swaps them into state
    // must not fire a second, redundant search here.
    if (loading) return;
    const dto = [
      ...toFilterRequest("boardGame", filters),
      ...toSortRequest("boardGame", sortsOrDefault(sorts, defaultSorts)),
    ];
    const dtoJson = JSON.stringify(dto);
    if (dtoJson === lastDto.current) return;
    lastDto.current = dtoJson;
    setSearching(true);
    const controller = new AbortController();
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      searchBoardGamesClient(dto, controller.signal)
        .then((rows) => {
          if (seq === searchSeq.current) {
            setGames(rows);
            setSearching(false);
          }
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.error("Search board games failed", error);
          if (seq === searchSeq.current) setSearching(false);
          showSnackbar({ message: loadErrorMessage(error), variant: "error" });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, sorts, defaultSorts, showSnackbar, loading]);

  // Apply `next` optimistically and PUT the whole game (title + values are
  // both required by the backend), rolling the list back on failure. Every
  // inline commit below funnels through here.
  const persist = useCallback(
    async (next: BoardGame) => {
      // Capture the pre-edit list inside the functional update so this callback
      // doesn't need `games` as a dependency.
      let prev: BoardGame[] = [];
      setGames((gs) => {
        prev = gs;
        return gs.map((g) => (g.id === next.id ? next : g));
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
        setGames(prev);
        showSnackbar({
          message:
            error instanceof Error
              ? `Couldn't update the board game: ${error.message}`
              : "Couldn't update the board game. Please try again.",
          variant: "error",
        });
      }
    },
    [showToast, showSnackbar],
  );

  // Commit an inline Title edit. Title is required, so blank (or unchanged)
  // values just exit edit mode.
  const commitTitle = useCallback(
    (game: BoardGame, raw: string) => {
      setEditingId(null);
      const title = raw.trim();
      if (title === "" || title === game.title) return;
      void persist({ ...game, title });
    },
    [persist],
  );

  // Commit a custom-field value edited inline in the grid (mass-edit mode):
  // merge the value into the game's customFieldValues and persist.
  const commitFieldValue = useCallback(
    (game: BoardGame, def: CustomField, value: string) => {
      const current =
        game.customFieldValues.find((v) => v.customFieldId === def.id)?.value ??
        "";
      if (value === current) return;
      const entry: CustomFieldValueType = toCustomFieldValue(def, value);
      const exists = game.customFieldValues.some(
        (v) => v.customFieldId === def.id,
      );
      const customFieldValues = exists
        ? game.customFieldValues.map((v) =>
            v.customFieldId === def.id ? entry : v,
          )
        : [...game.customFieldValues, entry];
      void persist({ ...game, customFieldValues });
    },
    [persist],
  );

  // Title and Boxes are always first; the rest of the columns are the board
  // game custom fields, in their defined order. In mass-edit mode the Title
  // cell becomes click-to-edit. Boxes is always a read-only count — the box
  // relationship is managed through board game boxes, not here.
  const columns = useMemo<ColumnDef<BoardGame>[]>(() => {
    const base: ColumnDef<BoardGame>[] = [
      {
        key: "title",
        label: "Title",
        width: 272,
        frozen: true,
        seam: true,
        render: massEditMode
          ? (game) => (
              <EditableTitleCell
                game={game}
                editing={editingId === game.id}
                onStart={() => setEditingId(game.id)}
                onCommit={(value) => commitTitle(game, value)}
                onCancel={() => setEditingId(null)}
              />
            )
          : (game) => game.title,
      },
      {
        key: "boxes",
        label: "Boxes",
        width: MIN_COL,
        align: "right",
        render: (game) => (
          <CustomFieldValue
            type="number"
            value={String(game.boardGameBoxes?.length ?? 0)}
          />
        ),
      },
    ];
    // In mass-edit mode, every custom-field cell becomes the full interactive
    // editor (the same controls as the game detail page) — committing an edit
    // persists the change. Otherwise every type shows its read-only display.
    const editableInline: CustomFieldType[] = [
      "text",
      "dropdown",
      "boolean",
      "number",
      "radio_button",
      "progress_bar",
    ];
    function renderFieldCell(game: BoardGame, def: CustomField) {
      const value = game.customFieldValues.find(
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
            onCommit={(v) => commitFieldValue(game, def, v)}
          />
        );
      }
      return (
        <CustomFieldValue type={def.type} value={value} options={def.options} />
      );
    }
    // Number and Yes/No values are narrow, so those columns default to the
    // minimum width to save space; the rest start wider.
    const dynamic: ColumnDef<BoardGame>[] = definitions.map((def) => ({
      key: `cf-${def.id}`,
      label: def.name,
      width: def.type === "number" || def.type === "boolean" ? MIN_COL : 180,
      // Numbers read better right-aligned so their digits line up down the column.
      align: def.type === "number" ? "right" : undefined,
      render: (game) => renderFieldCell(game, def),
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
    commitTitle,
    commitFieldValue,
  ]);

  const hasFilters = filters.length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.titleWrap}>
          <div className={styles.titleRow}>
            <h2 className={styles.entName}>{loading || searching ? "Loading…" : <><b>{games.length}</b> {games.length === 1 ? "Board Game" : "Board Games"}</>}</h2>
            {massEditMode && (
              <BeginnerHint
                placement="bottom-start"
                text={BEGINNER_HINTS.massEdit}
              />
            )}
          </div>
        </div>
        <FilterBar
          entityKey="boardGame"
          fields={fieldDefs}
          filters={filters}
          onChange={setFilters}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search board games…"
          searchAriaLabel="Search board games"
          searchHint={BEGINNER_HINTS.boardGameSearch}
          sorts={canSort ? sorts : undefined}
          onSortsChange={canSort ? setSorts : undefined}
        />
        {/* No New button: board games are created through board game boxes.
            A beginner hint sits where that button would be to explain why. */}
        <div className={styles.actions}>
          <BeginnerHint
            placement="bottom-end"
            text="Board Games can only be created and deleted through Board Game Boxes, (How they appear on your shelf) Go to the Shelf View and create a new box to create a new board game inside that box!"
          />
        </div>
      </div>

      <DataTable
        storageKey="board-games"
        columns={columns}
        rows={games}
        getRowKey={(game) => game.id}
        loading={loading}
        loadingMessage="Loading board games…"
        emptyMessage={
          hasFilters
            ? "No board games match your filters."
            : "No board games yet."
        }
        // No onDelete: the backend has no board game delete endpoint (games are
        // removed through their boxes), so the delete column is omitted.
        // The leading details column only appears in mass edit mode; otherwise
        // the whole row navigates to the game's detail page. Both routes are
        // the same — they just differ in affordance per mode.
        onOpenDetails={
          massEditMode
            ? (game) => router.push(`/board-games/${game.id}`)
            : undefined
        }
        detailsLabel={(game) => `View ${game.title}`}
        onRowClick={
          massEditMode
            ? undefined
            : (game) => router.push(`/board-games/${game.id}`)
        }
        rowClickLabel={(game) => `View ${game.title}`}
      />
    </div>
  );
}
