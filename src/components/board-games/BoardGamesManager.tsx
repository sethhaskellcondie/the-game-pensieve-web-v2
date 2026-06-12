"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BoardGame,
  CustomField,
  CustomFieldType,
  CustomFieldValue as CustomFieldValueType,
  FilterSpecification,
  UpdateBoardGameInput,
} from "@/lib/api";
import DataTable, {
  MIN_COL,
  type ColumnDef,
} from "@/components/data-table/DataTable";
import { useToast } from "@/components/ToastProvider";
import { useUiSettings } from "@/components/UiSettingsProvider";
import FilterBar from "@/components/filters/FilterBar";
import { buildFieldList } from "@/components/filters/fieldList";
import { toFilterRequest } from "@/components/filters/serialize";
import type { ActiveFilter } from "@/components/filters/types";
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

export default function BoardGamesManager() {
  const router = useRouter();
  const { showToast, showSnackbar } = useToast();
  const { settings } = useUiSettings();
  const massEditMode = settings.massEditMode;
  const standardFields = settings.standardFields.boardGame;
  const [games, setGames] = useState<BoardGame[]>([]);
  const [definitions, setDefinitions] = useState<CustomField[]>([]);
  const [spec, setSpec] = useState<FilterSpecification | null>(null);
  const [loading, setLoading] = useState(true);
  // The quick-search text (folded into a title-contains filter) and the explicit
  // filter chips. Both feed the server-side search.
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  // The row whose Title cell is being inline-edited, or null when idle.
  const [editingId, setEditingId] = useState<number | null>(null);

  // The unified field list (standard spec fields + custom fields) the filter
  // bar offers. Board games have no relationship filters, so no remapping.
  const fieldDefs = useMemo(
    () => buildFieldList(spec, definitions),
    [spec, definitions],
  );

  // Load the initial (unfiltered) games, the field definitions, and the filter
  // spec together on mount. setState lives in the promise callbacks (not the
  // effect body); `active` drops a stale response if the component unmounts
  // before the requests resolve.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      searchBoardGamesClient([], controller.signal),
      fetchEntityFields("boardGame", controller.signal),
      fetchFilterSpec("boardGame", controller.signal),
    ])
      .then(([loadedGames, loadedDefs, loadedSpec]) => {
        if (!active) return;
        setGames(loadedGames);
        setDefinitions(loadedDefs);
        setSpec(loadedSpec);
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
  }, [showSnackbar]);

  // Re-run the server search whenever the filter chips change. Debounced so
  // rapid edits coalesce, abortable so an in-flight request is cancelled, and
  // seq-guarded so only the newest response is committed (last-write-wins). The
  // initial load is handled by the mount effect, so the first run here (before
  // any user change) is skipped. The search box doesn't filter live — it adds a
  // title-contains chip on Enter, which flows through here.
  const didSearch = useRef(false);
  const searchSeq = useRef(0);
  useEffect(() => {
    if (!didSearch.current) {
      didSearch.current = true;
      return;
    }
    const controller = new AbortController();
    const seq = ++searchSeq.current;
    const dto = toFilterRequest("boardGame", filters);
    const timer = setTimeout(() => {
      searchBoardGamesClient(dto, controller.signal)
        .then((rows) => {
          if (seq === searchSeq.current) setGames(rows);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.error("Search board games failed", error);
          showSnackbar({ message: loadErrorMessage(error), variant: "error" });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, showSnackbar]);

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
      const entry: CustomFieldValueType = {
        customFieldId: def.id,
        customFieldName: def.name,
        customFieldType: def.type,
        value,
      };
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
          <h2 className={styles.entName}><b>{games.length}</b> {games.length === 1 ? "Board Game" : "Board Games"}</h2>
          {massEditMode && (
            <div className={styles.crumb}>
              <span>Mass edit mode is on. (adjust in options)</span>
            </div>
          )}
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
        />
        {/* No New button: board games are created through board game boxes. */}
      </div>

      <DataTable
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
