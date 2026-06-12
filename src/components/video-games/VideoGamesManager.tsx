"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  toCustomFieldValue,
  type CustomField,
  type CustomFieldOption,
  type CustomFieldType,
  type CustomFieldValue as CustomFieldValueType,
  type FilterSpecification,
  type System,
  type UpdateVideoGameInput,
  type VideoGame,
} from "@/lib/api";
import DataTable, {
  MIN_COL,
  type ColumnDef,
} from "@/components/data-table/DataTable";
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
import {
  fetchEntityFields,
  fetchFilterSpec,
  searchSystemsClient,
  searchVideoGamesClient,
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
// trigger, or the inline input while this cell is the one being edited. (The
// System cell uses FieldEditor's dropdown; Boxes is a read-only count.)
function EditableTitleCell({
  game,
  editing,
  onStart,
  onCommit,
  onCancel,
}: {
  game: VideoGame;
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
    ? `Couldn't load video games: ${error.message}`
    : "Couldn't load video games. Please try again.";
}

export default function VideoGamesManager() {
  const router = useRouter();
  const { showToast, showSnackbar } = useToast();
  const { settings } = useUiSettings();
  const massEditMode = settings.massEditMode;
  const standardFields = settings.standardFields.videoGame;
  const [games, setGames] = useState<VideoGame[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [definitions, setDefinitions] = useState<CustomField[]>([]);
  const [spec, setSpec] = useState<FilterSpecification | null>(null);
  const [loading, setLoading] = useState(true);
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
  // bar offers. The system_id entry gets a friendlier label and the systems
  // list as value/label choices, so the filter offers names while sending ids.
  const fieldDefs = useMemo(
    () =>
      buildFieldList(spec, definitions).map((f) =>
        f.kind === "system"
          ? {
              ...f,
              label: "System",
              valueOptions: systems.map((s) => ({
                value: String(s.id),
                label: s.name,
              })),
            }
          : f,
      ),
    [spec, definitions, systems],
  );

  // The System cell's dropdown options. FieldEditor's dropdown commits by
  // option name, so commitSystem maps the name back to the system.
  const systemOptions = useMemo<CustomFieldOption[]>(
    () =>
      systems.map((s, i) => ({
        id: s.id,
        customFieldId: -1,
        name: s.name,
        isDefault: false,
        order: i,
      })),
    [systems],
  );

  // The last search payload sent (and a sequence counter for last-write-wins),
  // shared by the mount load and the search effect below so neither repeats
  // the other's query.
  const lastDto = useRef("[]");
  const searchSeq = useRef(0);

  // Load the systems for the dropdowns, the field definitions, the filter
  // spec, and the stored default sort options together on mount, then run the
  // initial search with the resolved defaults so the first page of results
  // already honors them. The defaults stay out of the Sort button's state —
  // they only ever ride along in the request while the page has no sorts of
  // its own. setState lives in the promise callbacks (not the effect body);
  // `active` drops a stale response if the component unmounts before the
  // requests resolve.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      searchSystemsClient(controller.signal),
      fetchEntityFields("videoGame", controller.signal),
      fetchFilterSpec("videoGame", controller.signal),
      fetchDefaultSortOptions(controller.signal),
    ])
      .then(async ([loadedSystems, loadedDefs, loadedSpec, defaultSortOptions]) => {
        // Resolve the stored levels against the live field list (dropping any
        // field that no longer exists), and only when the spec advertises
        // sorting at all. lastDto is primed with the seeded payload so the
        // search effect below doesn't immediately re-run the same query.
        const seeded = supportsSorting(loadedSpec)
          ? resolveDefaultSorts(
              defaultSortOptions.videoGame,
              buildFieldList(loadedSpec, loadedDefs),
            )
          : [];
        const dto = toSortRequest("videoGame", seeded);
        lastDto.current = JSON.stringify(dto);
        const loadedGames = await searchVideoGamesClient(dto, controller.signal);
        if (!active) return;
        setGames(loadedGames);
        setSystems(loadedSystems);
        setDefinitions(loadedDefs);
        setSpec(loadedSpec);
        setDefaultSorts(seeded);
        setLoading(false);
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        console.error("Load video games failed", error);
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
    const dto = [
      ...toFilterRequest("videoGame", filters),
      ...toSortRequest("videoGame", sortsOrDefault(sorts, defaultSorts)),
    ];
    const dtoJson = JSON.stringify(dto);
    if (dtoJson === lastDto.current) return;
    lastDto.current = dtoJson;
    const controller = new AbortController();
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      searchVideoGamesClient(dto, controller.signal)
        .then((rows) => {
          if (seq === searchSeq.current) setGames(rows);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.error("Search video games failed", error);
          showSnackbar({ message: loadErrorMessage(error), variant: "error" });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, sorts, defaultSorts, showSnackbar]);

  // Apply `next` optimistically and PUT the whole game (title + systemId +
  // values are all required by the backend), rolling the list back on failure.
  // Every inline commit below funnels through here.
  const persist = useCallback(
    async (next: VideoGame) => {
      // Capture the pre-edit list inside the functional update so this callback
      // doesn't need `games` as a dependency.
      let prev: VideoGame[] = [];
      setGames((gs) => {
        prev = gs;
        return gs.map((g) => (g.id === next.id ? next : g));
      });
      try {
        const input: UpdateVideoGameInput = {
          title: next.title,
          systemId: next.system.id,
          customFieldValues: next.customFieldValues,
        };
        const res = await fetch(`/api/video-games/${next.id}`, {
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
        setGames(prev);
        showSnackbar({
          message:
            error instanceof Error
              ? `Couldn't update the video game: ${error.message}`
              : "Couldn't update the video game. Please try again.",
          variant: "error",
        });
      }
    },
    [showToast, showSnackbar],
  );

  // Commit an inline Title edit. Title is required, so blank (or unchanged)
  // values just exit edit mode.
  const commitTitle = useCallback(
    (game: VideoGame, raw: string) => {
      setEditingId(null);
      const title = raw.trim();
      if (title === "" || title === game.title) return;
      void persist({ ...game, title });
    },
    [persist],
  );

  // Commit a System dropdown pick: the editor reports the chosen system's name,
  // which maps back to the system itself (duplicate names resolve to the first
  // match). Unknown or unchanged picks are no-ops.
  const commitSystem = useCallback(
    (game: VideoGame, systemName: string) => {
      const next = systems.find((s) => s.name === systemName);
      if (!next || next.id === game.system.id) return;
      void persist({ ...game, system: next });
    },
    [systems, persist],
  );

  // Commit a custom-field value edited inline in the grid (mass-edit mode):
  // merge the value into the game's customFieldValues and persist.
  const commitFieldValue = useCallback(
    (game: VideoGame, def: CustomField, value: string) => {
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

  // Title, System, and Boxes are always first; the rest of the columns are the
  // video game custom fields, in their defined order. In mass-edit mode the
  // Title cell becomes click-to-edit and System becomes a dropdown of all
  // systems. Boxes is always a read-only count — the box relationship is
  // managed through video game boxes, not here.
  const columns = useMemo<ColumnDef<VideoGame>[]>(() => {
    const base: ColumnDef<VideoGame>[] = [
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
        key: "system",
        label: "System",
        width: 180,
        render: massEditMode
          ? (game) => (
              <FieldEditor
                field={{
                  name: "System",
                  kind: "dropdown",
                  value: game.system?.name ?? "",
                  options: systemOptions,
                }}
                onCommit={(v) => commitSystem(game, v)}
              />
            )
          : (game) => game.system?.name ?? "",
      },
      {
        key: "boxes",
        label: "Boxes",
        width: MIN_COL,
        render: (game) => (
          <CustomFieldValue
            type="number"
            value={String(game.videoGameBoxes?.length ?? 0)}
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
    function renderFieldCell(game: VideoGame, def: CustomField) {
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
    const dynamic: ColumnDef<VideoGame>[] = definitions.map((def) => ({
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
    systemOptions,
    commitTitle,
    commitSystem,
    commitFieldValue,
  ]);

  const hasFilters = filters.length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.titleWrap}>
          <h2 className={styles.entName}><b>{games.length}</b> {games.length === 1 ? "Video Game" : "Video Games"}</h2>
          {massEditMode && (
            <div className={styles.crumb}>
              <span>Mass edit mode is on.</span>
            </div>
          )}
        </div>
        <FilterBar
          entityKey="videoGame"
          fields={fieldDefs}
          filters={filters}
          onChange={setFilters}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search video games…"
          searchAriaLabel="Search video games"
          sorts={canSort ? sorts : undefined}
          onSortsChange={canSort ? setSorts : undefined}
        />
        {/* No New button: video games are created through video game boxes. */}
      </div>

      <DataTable
        columns={columns}
        rows={games}
        getRowKey={(game) => game.id}
        loading={loading}
        loadingMessage="Loading video games…"
        emptyMessage={
          hasFilters
            ? "No video games match your filters."
            : "No video games yet."
        }
        // No onDelete: the backend has no video game delete endpoint (games are
        // removed through their boxes), so the delete column is omitted.
        // The leading details column only appears in mass edit mode; otherwise
        // the whole row navigates to the game's detail page. Both routes are
        // the same — they just differ in affordance per mode.
        onOpenDetails={
          massEditMode
            ? (game) => router.push(`/video-games/${game.id}`)
            : undefined
        }
        detailsLabel={(game) => `View ${game.title}`}
        onRowClick={
          massEditMode
            ? undefined
            : (game) => router.push(`/video-games/${game.id}`)
        }
        rowClickLabel={(game) => `View ${game.title}`}
      />
    </div>
  );
}
