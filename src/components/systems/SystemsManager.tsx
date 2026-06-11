"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CustomField,
  CustomFieldType,
  CustomFieldValue as CustomFieldValueType,
  FilterRequestDto,
  FilterSpecification,
  System,
  UpdateSystemInput,
} from "@/lib/api";
import Button from "@/components/Button";
import DataTable, {
  MIN_COL,
  type ColumnDef,
} from "@/components/data-table/DataTable";
import { useToast } from "@/components/ToastProvider";
import { useUiSettings } from "@/components/UiSettingsProvider";
import { PlusIcon } from "@/components/custom-fields/icons";
import FilterBar from "@/components/filters/FilterBar";
import { buildFieldList } from "@/components/filters/fieldList";
import { toFilterRequest } from "@/components/filters/serialize";
import type { ActiveFilter } from "@/components/filters/types";
import CustomFieldValue from "@/components/toys/CustomFieldValue";
import FieldEditor, {
  normalizeFieldValue,
} from "@/components/toys/toyFieldEditors";
import SystemCreateModal from "./SystemCreateModal";
import styles from "@/components/toys/ToysManager.module.css";

// Self-contained inline editor for the Name column: holds its own draft so a
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

// One mass-edit-mode cell for the Name column: the value as a click-to-edit
// trigger, or the inline input while this cell is the one being edited.
// (Generation and Handheld use FieldEditor directly — they're a number and a
// boolean, so they get the same inline editors as custom fields of those types.)
function EditableNameCell({
  system,
  editing,
  onStart,
  onCommit,
  onCancel,
}: {
  system: System;
  editing: boolean;
  onStart: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  if (editing) {
    return (
      <InlineEditInput
        initial={system.name}
        ariaLabel={`Name for ${system.name}`}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
  }
  return (
    <button type="button" className={styles.editTrigger} onClick={onStart}>
      {system.name || <span className={styles.dash}>—</span>}
    </button>
  );
}

// Reads a route handler's response once, throwing the forwarded backend message
// on failure. Route handlers answer { status, data } or { status, message }.
async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as
    | { data?: T; message?: string }
    | null;
  if (!res.ok) {
    throw new Error(body?.message ?? "Request failed");
  }
  return body?.data as T;
}

// Run the backend search through the route handler (the lib/api search runs
// server-side). An empty filter set returns every system.
async function searchSystemsClient(
  filters: FilterRequestDto[],
  signal?: AbortSignal,
): Promise<System[]> {
  const res = await fetch("/api/systems/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters }),
    signal,
  });
  return readJson<System[]>(res);
}

// System custom-field definitions, reusing the existing custom-fields route.
// They give the authoritative ordered column set for the dynamic columns.
async function fetchSystemFields(signal?: AbortSignal): Promise<CustomField[]> {
  const res = await fetch("/api/custom-fields/entity/system", { signal });
  const data = await readJson<CustomField[]>(res);
  return [...data].sort((a, b) => a.order - b.order);
}

// The system filter spec (standard filterable fields + their operators). Merged
// with the custom fields to build the field list the filter bar offers.
async function fetchFilterSpec(
  signal?: AbortSignal,
): Promise<FilterSpecification> {
  const res = await fetch("/api/filters/system", { signal });
  return readJson<FilterSpecification>(res);
}

function loadErrorMessage(error: unknown): string {
  return error instanceof Error
    ? `Couldn't load systems: ${error.message}`
    : "Couldn't load systems. Please try again.";
}

export default function SystemsManager() {
  const router = useRouter();
  const { showToast, showSnackbar } = useToast();
  const { settings } = useUiSettings();
  const massEditMode = settings.massEditMode;
  const [systems, setSystems] = useState<System[]>([]);
  const [definitions, setDefinitions] = useState<CustomField[]>([]);
  const [spec, setSpec] = useState<FilterSpecification | null>(null);
  const [loading, setLoading] = useState(true);
  // The quick-search text (folded into a name-contains filter) and the explicit
  // filter chips. Both feed the server-side search.
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  // The unified field list (standard spec fields + custom fields) the filter bar
  // offers. Recomputed only when the spec or definitions change.
  const fieldDefs = useMemo(
    () => buildFieldList(spec, definitions),
    [spec, definitions],
  );
  // Whether the create-system dialog is open, and whether its POST is in flight.
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  // The row whose Name cell is being inline-edited, or null when idle.
  const [editingId, setEditingId] = useState<number | null>(null);

  // Load the initial (unfiltered) systems, their field definitions, and the
  // filter spec together on mount. setState lives in the promise callbacks (not
  // the effect body); `active` drops a stale response if the component unmounts
  // before the requests resolve.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      searchSystemsClient([], controller.signal),
      fetchSystemFields(controller.signal),
      fetchFilterSpec(controller.signal),
    ])
      .then(([loadedSystems, loadedDefs, loadedSpec]) => {
        if (!active) return;
        setSystems(loadedSystems);
        setDefinitions(loadedDefs);
        setSpec(loadedSpec);
        setLoading(false);
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        console.error("Load systems failed", error);
        setSystems([]);
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
  // name-contains chip on Enter, which flows through here.
  const didSearch = useRef(false);
  const searchSeq = useRef(0);
  useEffect(() => {
    if (!didSearch.current) {
      didSearch.current = true;
      return;
    }
    const controller = new AbortController();
    const seq = ++searchSeq.current;
    const dto = toFilterRequest("system", filters);
    const timer = setTimeout(() => {
      searchSystemsClient(dto, controller.signal)
        .then((rows) => {
          if (seq === searchSeq.current) setSystems(rows);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.error("Search systems failed", error);
          showSnackbar({ message: loadErrorMessage(error), variant: "error" });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, showSnackbar]);

  // Apply `next` optimistically and PUT the whole system (name + generation +
  // handheld + values are all required by the backend), rolling the list back
  // on failure. Every inline commit below funnels through here.
  const persist = useCallback(
    async (next: System) => {
      // Capture the pre-edit list inside the functional update so this callback
      // doesn't need `systems` as a dependency.
      let prev: System[] = [];
      setSystems((ss) => {
        prev = ss;
        return ss.map((s) => (s.id === next.id ? next : s));
      });
      try {
        const input: UpdateSystemInput = {
          name: next.name,
          generation: next.generation,
          handheld: next.handheld,
          customFieldValues: next.customFieldValues,
        };
        const res = await fetch(`/api/systems/${next.id}`, {
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
        showToast({ message: "System updated.", variant: "success" });
      } catch (error) {
        console.error("Update system failed", error);
        setSystems(prev);
        showSnackbar({
          message:
            error instanceof Error
              ? `Couldn't update the system: ${error.message}`
              : "Couldn't update the system. Please try again.",
          variant: "error",
        });
      }
    },
    [showToast, showSnackbar],
  );

  // Commit an inline Name edit. Name is required, so blank (or unchanged)
  // values just exit edit mode.
  const commitName = useCallback(
    (system: System, raw: string) => {
      setEditingId(null);
      const name = raw.trim();
      if (name === "" || name === system.name) return;
      void persist({ ...system, name });
    },
    [persist],
  );

  // Generation is a required integer; the number editor commits "" when
  // cleared, which (like an unchanged value) is a no-op revert.
  const commitGeneration = useCallback(
    (system: System, raw: string) => {
      if (raw === "") return;
      const generation = Number(raw);
      if (Number.isNaN(generation) || generation === system.generation) return;
      void persist({ ...system, generation });
    },
    [persist],
  );

  const commitHandheld = useCallback(
    (system: System, raw: string) => {
      const handheld = raw === "true";
      if (handheld === system.handheld) return;
      void persist({ ...system, handheld });
    },
    [persist],
  );

  // Commit a custom-field value edited inline in the grid (mass-edit mode):
  // merge the value into the system's customFieldValues and persist.
  const commitFieldValue = useCallback(
    (system: System, def: CustomField, value: string) => {
      const current =
        system.customFieldValues.find((v) => v.customFieldId === def.id)
          ?.value ?? "";
      if (value === current) return;
      const entry: CustomFieldValueType = {
        customFieldId: def.id,
        customFieldName: def.name,
        customFieldType: def.type,
        value,
      };
      const exists = system.customFieldValues.some(
        (v) => v.customFieldId === def.id,
      );
      const customFieldValues = exists
        ? system.customFieldValues.map((v) =>
            v.customFieldId === def.id ? entry : v,
          )
        : [...system.customFieldValues, entry];
      void persist({ ...system, customFieldValues });
    },
    [persist],
  );

  // Create a system from the dialog: POST it and prepend the saved system (with
  // its backend-assigned id) to the list. Returns whether it succeeded; the
  // dialog decides what to do next (close, or reset for another entry in
  // mass-input mode). On failure it stays open so the user can retry without
  // re-entering.
  const handleCreate = useCallback(
    async (input: UpdateSystemInput): Promise<boolean> => {
      setSaving(true);
      try {
        const res = await fetch("/api/systems", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const created = await readJson<System>(res);
        setSystems((ss) => [created, ...ss]);
        showToast({ message: "System created.", variant: "success" });
        return true;
      } catch (error) {
        console.error("Create system failed", error);
        showSnackbar({
          message:
            error instanceof Error
              ? `Couldn't create the system: ${error.message}`
              : "Couldn't create the system. Please try again.",
          variant: "error",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [showToast, showSnackbar],
  );

  // Delete a system (the grid's trash asks "Are you sure?" first). The row
  // only leaves the grid once the backend confirms; a system still referenced
  // by games/boxes surfaces the backend's rejection in the snackbar.
  const handleDelete = useCallback(
    async (system: System): Promise<void> => {
      try {
        const res = await fetch(`/api/systems/${system.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(body?.message ?? "Request failed");
        }
        setSystems((ss) => ss.filter((s) => s.id !== system.id));
        showToast({ message: "System deleted.", variant: "success" });
      } catch (error) {
        console.error("Delete system failed", error);
        showSnackbar({
          message:
            error instanceof Error
              ? `Couldn't delete the system: ${error.message}`
              : "Couldn't delete the system. Please try again.",
          variant: "error",
        });
      }
    },
    [showToast, showSnackbar],
  );

  // Name, Generation, and Handheld are always first; the rest of the columns
  // are the system custom fields, in their defined order. In mass-edit mode the
  // Name cell becomes click-to-edit and Generation/Handheld get the same inline
  // editors as number/boolean custom fields.
  const columns = useMemo<ColumnDef<System>[]>(() => {
    const base: ColumnDef<System>[] = [
      {
        key: "name",
        label: "Name",
        width: 272,
        frozen: true,
        seam: true,
        render: massEditMode
          ? (system) => (
              <EditableNameCell
                system={system}
                editing={editingId === system.id}
                onStart={() => setEditingId(system.id)}
                onCommit={(value) => commitName(system, value)}
                onCancel={() => setEditingId(null)}
              />
            )
          : (system) => system.name,
      },
      {
        key: "generation",
        label: "Generation",
        width: MIN_COL,
        render: massEditMode
          ? (system) => (
              <FieldEditor
                field={{
                  name: "Generation",
                  kind: "number",
                  value: String(system.generation),
                }}
                onCommit={(v) => commitGeneration(system, v)}
              />
            )
          : (system) => (
              <CustomFieldValue
                type="number"
                value={String(system.generation)}
              />
            ),
      },
      {
        key: "handheld",
        label: "Handheld",
        width: MIN_COL,
        render: massEditMode
          ? (system) => (
              <FieldEditor
                field={{
                  name: "Handheld",
                  kind: "boolean",
                  value: system.handheld ? "true" : "false",
                }}
                onCommit={(v) => commitHandheld(system, v)}
              />
            )
          : (system) => (
              <CustomFieldValue
                type="boolean"
                value={system.handheld ? "true" : "false"}
              />
            ),
      },
    ];
    // In mass-edit mode, every custom-field cell becomes the full interactive
    // editor (the same controls as the system detail page) — committing an edit
    // persists the change. Otherwise every type shows its read-only display.
    const editableInline: CustomFieldType[] = [
      "text",
      "dropdown",
      "boolean",
      "number",
      "radio_button",
      "progress_bar",
    ];
    function renderFieldCell(system: System, def: CustomField) {
      const value = system.customFieldValues.find(
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
            onCommit={(v) => commitFieldValue(system, def, v)}
          />
        );
      }
      return (
        <CustomFieldValue type={def.type} value={value} options={def.options} />
      );
    }
    // Number and Yes/No values are narrow, so those columns default to the
    // minimum width to save space; the rest start wider.
    const dynamic: ColumnDef<System>[] = definitions.map((def) => ({
      key: `cf-${def.id}`,
      label: def.name,
      width: def.type === "number" || def.type === "boolean" ? MIN_COL : 180,
      render: (system) => renderFieldCell(system, def),
    }));
    return [...base, ...dynamic];
  }, [
    definitions,
    massEditMode,
    editingId,
    commitName,
    commitGeneration,
    commitHandheld,
    commitFieldValue,
  ]);

  const hasFilters = filters.length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.titleWrap}>
          <h2 className={styles.entName}><b>{systems.length}</b> {systems.length === 1 ? "System" : "Systems"}</h2>
          {massEditMode && (
            <div className={styles.crumb}>
              <span>Mass edit mode is on. (adjust in options)</span>
            </div>
          )}
        </div>
        <FilterBar
          entityKey="system"
          fields={fieldDefs}
          filters={filters}
          onChange={setFilters}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search systems…"
          searchAriaLabel="Search systems"
        />
        <div className={styles.actions}>
          <Button className={styles.newBtn} onClick={() => setCreating(true)}>
            <PlusIcon /> New
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={systems}
        getRowKey={(system) => system.id}
        loading={loading}
        loadingMessage="Loading systems…"
        emptyMessage={
          hasFilters ? "No systems match your filters." : "No systems yet."
        }
        onDelete={(system) => void handleDelete(system)}
        deleteLabel={(system) => `Delete ${system.name}`}
        confirmDelete
        // The leading details column only appears in mass edit mode; otherwise
        // the whole row navigates to the system's detail page. Both routes are
        // the same — they just differ in affordance per mode.
        onOpenDetails={
          massEditMode
            ? (system) => router.push(`/systems/${system.id}`)
            : undefined
        }
        detailsLabel={(system) => `View ${system.name}`}
        onRowClick={
          massEditMode
            ? undefined
            : (system) => router.push(`/systems/${system.id}`)
        }
        rowClickLabel={(system) => `View ${system.name}`}
      />

      {creating && (
        <SystemCreateModal
          definitions={definitions}
          saving={saving}
          onCreate={handleCreate}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
