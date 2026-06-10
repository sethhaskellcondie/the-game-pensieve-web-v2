"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CustomField,
  CustomFieldType,
  CustomFieldValue as CustomFieldValueType,
  Toy,
  UpdateToyInput,
} from "@/lib/api";
import Button from "@/components/Button";
import DataTable, {
  MIN_COL,
  type ColumnDef,
} from "@/components/data-table/DataTable";
import { useToast } from "@/components/ToastProvider";
import { useUiSettings } from "@/components/UiSettingsProvider";
import { PlusIcon } from "@/components/custom-fields/icons";
import CustomFieldValue from "./CustomFieldValue";
import FieldEditor, { normalizeFieldValue } from "./toyFieldEditors";
import { FilterIcon, SearchIcon } from "./icons";
import styles from "./ToysManager.module.css";

// The two toy columns that mass-edit mode makes inline-editable.
type EditField = "name" | "set";
const FIELD_LABEL: Record<EditField, string> = { name: "Name", set: "Set" };

// Self-contained inline editor: holds its own draft so a keystroke re-renders
// only this input, not the whole table. Commits on Enter/blur, cancels on
// Escape. A latch keeps the Enter-then-blur sequence from committing twice.
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

// One mass-edit-mode cell for the Name/Set columns: the value as a click-to-edit
// trigger, or the inline input while this cell is the one being edited.
function EditableToyCell({
  toy,
  field,
  editing,
  onStart,
  onCommit,
  onCancel,
}: {
  toy: Toy;
  field: EditField;
  editing: boolean;
  onStart: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  if (editing) {
    return (
      <InlineEditInput
        initial={toy[field]}
        ariaLabel={`${FIELD_LABEL[field]} for ${toy.name}`}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
  }
  return (
    <button type="button" className={styles.editTrigger} onClick={onStart}>
      {toy[field] || <span className={styles.dash}>—</span>}
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

async function fetchToys(signal?: AbortSignal): Promise<Toy[]> {
  const res = await fetch("/api/toys", { signal });
  return readJson<Toy[]>(res);
}

// Toy custom-field definitions, reusing the existing custom-fields route. They
// give the authoritative ordered column set for the dynamic columns.
async function fetchToyFields(signal?: AbortSignal): Promise<CustomField[]> {
  const res = await fetch("/api/custom-fields/entity/toy", { signal });
  const data = await readJson<CustomField[]>(res);
  return [...data].sort((a, b) => a.order - b.order);
}

function loadErrorMessage(error: unknown): string {
  return error instanceof Error
    ? `Couldn't load toys: ${error.message}`
    : "Couldn't load toys. Please try again.";
}

export default function ToysManager() {
  const router = useRouter();
  const { showToast, showSnackbar } = useToast();
  const { settings } = useUiSettings();
  const massEditMode = settings.massEditMode;
  const [toys, setToys] = useState<Toy[]>([]);
  const [definitions, setDefinitions] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  // The cell being inline-edited (row id + which column), or null when idle.
  const [editing, setEditing] = useState<{ id: number; field: EditField } | null>(
    null,
  );

  // Load toys and their field definitions together on mount. setState lives in
  // the promise callbacks (not the effect body); `active` drops a stale response
  // if the component unmounts before the requests resolve.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      fetchToys(controller.signal),
      fetchToyFields(controller.signal),
    ])
      .then(([loadedToys, loadedDefs]) => {
        if (!active) return;
        setToys(loadedToys);
        setDefinitions(loadedDefs);
        setLoading(false);
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        console.error("Load toys failed", error);
        setToys([]);
        setDefinitions([]);
        setLoading(false);
        showSnackbar({ message: loadErrorMessage(error), variant: "error" });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [showSnackbar]);

  const startEdit = useCallback((toy: Toy, field: EditField) => {
    setEditing({ id: toy.id, field });
  }, []);

  const cancelEdit = useCallback(() => setEditing(null), []);

  // Commit an inline edit. Blank or unchanged values just exit edit mode.
  // Otherwise the change is applied optimistically and rolled back on failure.
  // The PUT resends the whole toy (name + set + values are all required by the
  // backend), swapping in only the edited field.
  const commitEdit = useCallback(
    async (toy: Toy, field: EditField, raw: string) => {
      setEditing(null);
      const next = raw.trim();
      if (next === "" || next === toy[field]) return;
      // Capture the pre-edit list inside the functional update so this callback
      // doesn't need `toys` as a dependency.
      let prev: Toy[] = [];
      setToys((ts) => {
        prev = ts;
        return ts.map((t) => (t.id === toy.id ? { ...t, [field]: next } : t));
      });
      try {
        const input: UpdateToyInput = {
          name: field === "name" ? next : toy.name,
          set: field === "set" ? next : toy.set,
          customFieldValues: toy.customFieldValues,
        };
        const res = await fetch(`/api/toys/${toy.id}`, {
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
        showToast({ message: "Toy updated.", variant: "success" });
      } catch (error) {
        console.error("Update toy failed", error);
        setToys(prev);
        showSnackbar({
          message:
            error instanceof Error
              ? `Couldn't update the toy: ${error.message}`
              : "Couldn't update the toy. Please try again.",
          variant: "error",
        });
      }
    },
    [showToast, showSnackbar],
  );

  // Commit a custom-field value edited inline in the grid (mass-edit mode).
  // Mirrors commitEdit: merge the value into the toy's customFieldValues, apply
  // optimistically, PUT the whole toy, and roll back on failure.
  const commitFieldValue = useCallback(
    async (toy: Toy, def: CustomField, value: string) => {
      const current =
        toy.customFieldValues.find((v) => v.customFieldId === def.id)?.value ??
        "";
      if (value === current) return;
      const entry: CustomFieldValueType = {
        customFieldId: def.id,
        customFieldName: def.name,
        customFieldType: def.type,
        value,
      };
      const exists = toy.customFieldValues.some(
        (v) => v.customFieldId === def.id,
      );
      const customFieldValues = exists
        ? toy.customFieldValues.map((v) =>
            v.customFieldId === def.id ? entry : v,
          )
        : [...toy.customFieldValues, entry];
      let prev: Toy[] = [];
      setToys((ts) => {
        prev = ts;
        return ts.map((t) =>
          t.id === toy.id ? { ...t, customFieldValues } : t,
        );
      });
      try {
        const input: UpdateToyInput = {
          name: toy.name,
          set: toy.set,
          customFieldValues,
        };
        const res = await fetch(`/api/toys/${toy.id}`, {
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
        showToast({ message: "Toy updated.", variant: "success" });
      } catch (error) {
        console.error("Update toy failed", error);
        setToys(prev);
        showSnackbar({
          message:
            error instanceof Error
              ? `Couldn't update the toy: ${error.message}`
              : "Couldn't update the toy. Please try again.",
          variant: "error",
        });
      }
    },
    [showToast, showSnackbar],
  );

  // Name and Set are always first; the rest of the columns are the toy custom
  // fields, in their defined order. Each cell maps the toy's values by field id.
  // In mass-edit mode, Name and Set become inline-editable.
  const columns = useMemo<ColumnDef<Toy>[]>(() => {
    function renderEditable(toy: Toy, field: EditField) {
      return (
        <EditableToyCell
          toy={toy}
          field={field}
          editing={editing?.id === toy.id && editing.field === field}
          onStart={() => startEdit(toy, field)}
          onCommit={(value) => commitEdit(toy, field, value)}
          onCancel={cancelEdit}
        />
      );
    }
    const base: ColumnDef<Toy>[] = [
      {
        key: "name",
        label: "Name",
        width: 272,
        frozen: true,
        seam: true,
        render: massEditMode
          ? (toy) => renderEditable(toy, "name")
          : (toy) => toy.name,
      },
      {
        key: "set",
        label: "Set",
        width: 200,
        render: massEditMode
          ? (toy) => renderEditable(toy, "set")
          : (toy) => toy.set,
      },
    ];
    // In mass-edit mode, dropdown and Yes/No cells become the full interactive
    // editor (the same controls as the toy detail page) — clicking commits the
    // change. Otherwise every type shows its read-only display. Remaining types
    // get inline editing in follow-ups.
    const editableInline: CustomFieldType[] = [
      "dropdown",
      "boolean",
      "number",
      "radio_button",
      "progress_bar",
    ];
    function renderFieldCell(toy: Toy, def: CustomField) {
      const value = toy.customFieldValues.find(
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
            onCommit={(v) => commitFieldValue(toy, def, v)}
          />
        );
      }
      return (
        <CustomFieldValue type={def.type} value={value} options={def.options} />
      );
    }
    // Number and Yes/No values are narrow, so those columns default to the
    // minimum width to save space; the rest start wider.
    const dynamic: ColumnDef<Toy>[] = definitions.map((def) => ({
      key: `cf-${def.id}`,
      label: def.name,
      width:
        def.type === "number" || def.type === "boolean" ? MIN_COL : 180,
      render: (toy) => renderFieldCell(toy, def),
    }));
    return [...base, ...dynamic];
  }, [
    definitions,
    massEditMode,
    editing,
    startEdit,
    cancelEdit,
    commitEdit,
    commitFieldValue,
  ]);

  // Client-side search over name + set. (Server-side filtering via the search
  // endpoint is a follow-up.)
  const filteredToys = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return toys;
    return toys.filter(
      (toy) =>
        toy.name.toLowerCase().includes(q) ||
        toy.set.toLowerCase().includes(q),
    );
  }, [toys, query]);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.titleWrap}>
          <h2 className={styles.entName}><b>{filteredToys.length}</b> {filteredToys.length === 1 ? "Toy" : "Toys"}</h2>
          {massEditMode && (
            <div className={styles.crumb}>
              <span>Mass edit mode is on. (adjust in options)</span>
            </div>
          )}
        </div>
        <div className={styles.actions}>
          <div className={styles.search}>
            <SearchIcon className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search toys…"
              aria-label="Search toys"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {/* Filter + New + per-row delete are not wired to the backend yet
              (inert). */}
          <Button className={styles.filterBtn}>
            <FilterIcon /> Filter
          </Button>
          <Button className={styles.newBtn}>
            <PlusIcon /> New
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredToys}
        getRowKey={(toy) => toy.id}
        loading={loading}
        loadingMessage="Loading toys…"
        emptyMessage={query.trim() ? "No toys match your search." : "No toys yet."}
        onDelete={() => {}}
        deleteLabel={(toy) => `Delete ${toy.name}`}
        // The leading details column only appears in mass edit mode; otherwise
        // the whole row navigates to the toy's detail page. Both routes are the
        // same — they just differ in affordance per mode.
        onOpenDetails={
          massEditMode ? (toy) => router.push(`/toys/${toy.id}`) : undefined
        }
        detailsLabel={(toy) => `View ${toy.name}`}
        onRowClick={
          massEditMode ? undefined : (toy) => router.push(`/toys/${toy.id}`)
        }
        rowClickLabel={(toy) => `View ${toy.name}`}
      />
    </div>
  );
}
