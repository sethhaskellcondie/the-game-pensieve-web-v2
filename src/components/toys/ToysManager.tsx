"use client";

import { useEffect, useMemo, useState } from "react";
import type { CustomField, Toy } from "@/lib/api";
import Button from "@/components/Button";
import DataTable, { type ColumnDef } from "@/components/data-table/DataTable";
import { useToast } from "@/components/ToastProvider";
import { PlusIcon } from "@/components/custom-fields/icons";
import { formatCustomFieldValue } from "./format";
import { FilterIcon, SearchIcon } from "./icons";
import styles from "./ToysManager.module.css";

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
  const { showSnackbar } = useToast();
  const [toys, setToys] = useState<Toy[]>([]);
  const [definitions, setDefinitions] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

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

  // Name and Set are always first; the rest of the columns are the toy custom
  // fields, in their defined order. Each cell maps the toy's values by field id.
  const columns = useMemo<ColumnDef<Toy>[]>(() => {
    const base: ColumnDef<Toy>[] = [
      {
        key: "name",
        label: "Name",
        width: 272,
        frozen: true,
        seam: true,
        render: (toy) => toy.name,
      },
      { key: "set", label: "Set", width: 200, render: (toy) => toy.set },
    ];
    const dynamic: ColumnDef<Toy>[] = definitions.map((def) => ({
      key: `cf-${def.id}`,
      label: def.name,
      width: 180,
      render: (toy) =>
        formatCustomFieldValue(
          def.type,
          toy.customFieldValues.find((cv) => cv.customFieldId === def.id)?.value,
        ),
    }));
    return [...base, ...dynamic];
  }, [definitions]);

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
      />
    </div>
  );
}
