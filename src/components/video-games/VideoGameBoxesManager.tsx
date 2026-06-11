"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CustomField,
  CustomFieldOption,
  CustomFieldType,
  CustomFieldValue as CustomFieldValueType,
  FilterSpecification,
  System,
  UpdateVideoGameBoxInput,
  VideoGameBox,
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
import { buildFieldList } from "@/components/filters/fieldList";
import { toFilterRequest } from "@/components/filters/serialize";
import type { ActiveFilter } from "@/components/filters/types";
import CustomFieldValue from "@/components/toys/CustomFieldValue";
import FieldEditor, {
  normalizeFieldValue,
} from "@/components/toys/toyFieldEditors";
import styles from "@/components/toys/ToysManager.module.css";
import VideoGameBoxCreateModal from "./VideoGameBoxCreateModal";
import {
  fetchEntityFields,
  fetchFilterSpec,
  readJson,
  searchSystemsClient,
  searchVideoGameBoxesClient,
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
  box: VideoGameBox;
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
    ? `Couldn't load video game boxes: ${error.message}`
    : "Couldn't load video game boxes. Please try again.";
}

// The shelf view of the video games page: the same table treatment as the
// list view, but each row is a video game box (the case the games live in)
// searched through the videoGameBox endpoints.
export default function VideoGameBoxesManager() {
  const router = useRouter();
  const { showToast, showSnackbar } = useToast();
  const { settings } = useUiSettings();
  const massEditMode = settings.massEditMode;
  const [boxes, setBoxes] = useState<VideoGameBox[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [definitions, setDefinitions] = useState<CustomField[]>([]);
  // The videoGame entity's custom fields — the create dialog's stacked
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

  // Load the initial (unfiltered) boxes, the systems for the dropdowns, the
  // field definitions, and the filter spec together on mount. setState lives in
  // the promise callbacks (not the effect body); `active` drops a stale
  // response if the component unmounts before the requests resolve.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      searchVideoGameBoxesClient([], controller.signal),
      searchSystemsClient(controller.signal),
      fetchEntityFields("videoGameBox", controller.signal),
      fetchEntityFields("videoGame", controller.signal),
      fetchFilterSpec("videoGameBox", controller.signal),
    ])
      .then(
        ([loadedBoxes, loadedSystems, loadedDefs, loadedGameDefs, loadedSpec]) => {
          if (!active) return;
          setBoxes(loadedBoxes);
          setSystems(loadedSystems);
          setDefinitions(loadedDefs);
          setGameDefinitions(loadedGameDefs);
          setSpec(loadedSpec);
          setLoading(false);
        },
      )
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        console.error("Load video game boxes failed", error);
        setBoxes([]);
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
    const dto = toFilterRequest("videoGameBox", filters);
    const timer = setTimeout(() => {
      searchVideoGameBoxesClient(dto, controller.signal)
        .then((rows) => {
          if (seq === searchSeq.current) setBoxes(rows);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.error("Search video game boxes failed", error);
          showSnackbar({ message: loadErrorMessage(error), variant: "error" });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, showSnackbar]);

  // Apply `next` optimistically and PUT the whole box — the backend's
  // VideoGameBoxRequest requires every field, so the box's current game ids
  // ride along (newVideoGames stays empty: this grid edits box fields only).
  // Every inline commit below funnels through here.
  const persist = useCallback(
    async (next: VideoGameBox) => {
      // Capture the pre-edit list inside the functional update so this callback
      // doesn't need `boxes` as a dependency.
      let prev: VideoGameBox[] = [];
      setBoxes((bs) => {
        prev = bs;
        return bs.map((b) => (b.id === next.id ? next : b));
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
        setBoxes(prev);
        showSnackbar({
          message:
            error instanceof Error
              ? `Couldn't update the video game box: ${error.message}`
              : "Couldn't update the video game box. Please try again.",
          variant: "error",
        });
      }
    },
    [showToast, showSnackbar],
  );

  // Commit an inline Title edit. Title is required, so blank (or unchanged)
  // values just exit edit mode.
  const commitTitle = useCallback(
    (box: VideoGameBox, raw: string) => {
      setEditingId(null);
      const title = raw.trim();
      if (title === "" || title === box.title) return;
      void persist({ ...box, title });
    },
    [persist],
  );

  // Commit a System dropdown pick: the editor reports the chosen system's name,
  // which maps back to the system itself (duplicate names resolve to the first
  // match). Unknown or unchanged picks are no-ops.
  const commitSystem = useCallback(
    (box: VideoGameBox, systemName: string) => {
      const next = systems.find((s) => s.name === systemName);
      if (!next || next.id === box.system.id) return;
      void persist({ ...box, system: next });
    },
    [systems, persist],
  );

  const commitPhysical = useCallback(
    (box: VideoGameBox, raw: string) => {
      const isPhysical = raw === "true";
      if (isPhysical === box.isPhysical) return;
      void persist({ ...box, isPhysical });
    },
    [persist],
  );

  // Commit a custom-field value edited inline in the grid (mass-edit mode):
  // merge the value into the box's customFieldValues and persist.
  const commitFieldValue = useCallback(
    (box: VideoGameBox, def: CustomField, value: string) => {
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

  // Title, System, Games, Physical, and Collection are always first; the rest
  // of the columns are the box custom fields, in their defined order. In
  // mass-edit mode the Title cell becomes click-to-edit, System becomes a
  // dropdown of all systems, and Physical gets the inline boolean editor.
  // Games stays a read-only count (the game relationship isn't edited here)
  // and Collection is always read-only — the backend derives it from the
  // box's game count.
  const columns = useMemo<ColumnDef<VideoGameBox>[]>(() => {
    const base: ColumnDef<VideoGameBox>[] = [
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
        key: "system",
        label: "System",
        width: 180,
        render: massEditMode
          ? (box) => (
              <FieldEditor
                field={{
                  name: "System",
                  kind: "dropdown",
                  value: box.system?.name ?? "",
                  options: systemOptions,
                }}
                onCommit={(v) => commitSystem(box, v)}
              />
            )
          : (box) => box.system?.name ?? "",
      },
      {
        key: "games",
        label: "Games",
        width: MIN_COL,
        render: (box) => (
          <CustomFieldValue
            type="number"
            value={String(box.videoGames?.length ?? 0)}
          />
        ),
      },
      {
        key: "physical",
        label: "Physical",
        width: MIN_COL,
        render: massEditMode
          ? (box) => (
              <FieldEditor
                field={{
                  name: "Physical",
                  kind: "boolean",
                  value: box.isPhysical ? "true" : "false",
                }}
                onCommit={(v) => commitPhysical(box, v)}
              />
            )
          : (box) => (
              <CustomFieldValue
                type="boolean"
                value={box.isPhysical ? "true" : "false"}
              />
            ),
      },
      {
        key: "collection",
        label: "Collection",
        width: MIN_COL,
        render: (box) => (
          <CustomFieldValue
            type="boolean"
            value={box.isCollection ? "true" : "false"}
          />
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
    function renderFieldCell(box: VideoGameBox, def: CustomField) {
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
    const dynamic: ColumnDef<VideoGameBox>[] = definitions.map((def) => ({
      key: `cf-${def.id}`,
      label: def.name,
      width: def.type === "number" || def.type === "boolean" ? MIN_COL : 180,
      render: (box) => renderFieldCell(box, def),
    }));
    return [...base, ...dynamic];
  }, [
    definitions,
    massEditMode,
    editingId,
    systemOptions,
    commitTitle,
    commitSystem,
    commitPhysical,
    commitFieldValue,
  ]);

  // Create a box from the dialog: POST it and prepend the saved box (with its
  // backend-assigned id) to the list. Returns whether it succeeded; the dialog
  // decides what to do next (close, or reset for another entry in mass-input
  // mode). On failure it stays open so the user can retry without re-entering.
  const handleCreate = useCallback(
    async (input: UpdateVideoGameBoxInput): Promise<boolean> => {
      setSaving(true);
      try {
        const res = await fetch("/api/video-game-boxes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const created = await readJson<VideoGameBox>(res);
        setBoxes((bs) => [created, ...bs]);
        showToast({ message: "Video game box created.", variant: "success" });
        return true;
      } catch (error) {
        console.error("Create video game box failed", error);
        showSnackbar({
          message:
            error instanceof Error
              ? `Couldn't create the video game box: ${error.message}`
              : "Couldn't create the video game box. Please try again.",
          variant: "error",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [showToast, showSnackbar],
  );

  // Delete a box (the grid's trash asks "Are you sure?" first — the backend
  // also deletes any of the box's games that live in no other box). The row
  // only leaves the grid once the backend confirms.
  const handleDelete = useCallback(
    async (box: VideoGameBox): Promise<void> => {
      try {
        const res = await fetch(`/api/video-game-boxes/${box.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(body?.message ?? "Request failed");
        }
        setBoxes((bs) => bs.filter((b) => b.id !== box.id));
        showToast({ message: "Video game box deleted.", variant: "success" });
      } catch (error) {
        console.error("Delete video game box failed", error);
        showSnackbar({
          message:
            error instanceof Error
              ? `Couldn't delete the video game box: ${error.message}`
              : "Couldn't delete the video game box. Please try again.",
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
          <h2 className={styles.entName}><b>{boxes.length}</b> {boxes.length === 1 ? "Video Game Box" : "Video Game Boxes"}</h2>
          {massEditMode && (
            <div className={styles.crumb}>
              <span>Mass edit mode is on. (adjust in options)</span>
            </div>
          )}
        </div>
        <FilterBar
          entityKey="videoGameBox"
          fields={fieldDefs}
          filters={filters}
          onChange={setFilters}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search video game boxes…"
          searchAriaLabel="Search video game boxes"
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
        loadingMessage="Loading video game boxes…"
        emptyMessage={
          hasFilters
            ? "No video game boxes match your filters."
            : "No video game boxes yet."
        }
        // Deleting a box also deletes games that live in no other box, so the
        // trash goes through the confirmDelete "Are you sure?" menu.
        onDelete={(box) => void handleDelete(box)}
        deleteLabel={(box) => `Delete ${box.title}`}
        confirmDelete
        // The leading details column only appears in mass edit mode; otherwise
        // the whole row navigates to the box's detail page. Both routes are
        // the same — they just differ in affordance per mode.
        onOpenDetails={
          massEditMode
            ? (box) => router.push(`/video-game-boxes/${box.id}`)
            : undefined
        }
        detailsLabel={(box) => `View ${box.title}`}
        onRowClick={
          massEditMode
            ? undefined
            : (box) => router.push(`/video-game-boxes/${box.id}`)
        }
        rowClickLabel={(box) => `View ${box.title}`}
      />

      {creating && (
        <VideoGameBoxCreateModal
          definitions={definitions}
          gameDefinitions={gameDefinitions}
          systems={systems}
          saving={saving}
          onCreate={handleCreate}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
