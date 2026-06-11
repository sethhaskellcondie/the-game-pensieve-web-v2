"use client";

import { useState } from "react";
import { PlusIcon } from "@/components/custom-fields/icons";
import { FilterIcon, SearchIcon } from "@/components/toys/icons";
import FilterChip from "./FilterChip";
import FilterEditor from "./FilterEditor";
import type { ActiveFilter, EntityKey, FilterFieldDef } from "./types";
import styles from "./FilterBar.module.css";

// What the editor popover is currently doing: closed, adding a new filter, or
// editing an existing one (anchored to its chip).
type EditState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; filter: ActiveFilter };

// A reusable, presentational filter bar: a quick-search box, a chip per applied
// filter, and an "+ Add filter" control that opens the editor. Fully controlled
// — it never fetches; the parent resolves `filters` + `searchValue` into a
// search request. Reused across entity pages by passing a different `fields`
// list and search copy.
export default function FilterBar({
  fields,
  filters,
  onChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  searchAriaLabel = "Search",
}: {
  entityKey: EntityKey;
  fields: FilterFieldDef[];
  filters: ActiveFilter[];
  onChange: (next: ActiveFilter[]) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
}) {
  const [edit, setEdit] = useState<EditState>({ mode: "closed" });

  const sourceOf = (token: string): "standard" | "custom" =>
    fields.find((f) => f.field === token)?.source ?? "custom";

  const applyAdd = (filter: ActiveFilter) => {
    onChange([...filters, filter]);
    setEdit({ mode: "closed" });
  };

  const applyEdit = (filter: ActiveFilter) => {
    onChange(filters.map((f) => (f.id === filter.id ? filter : f)));
    setEdit({ mode: "closed" });
  };

  const remove = (id: string) => {
    onChange(filters.filter((f) => f.id !== id));
  };

  const hasFields = fields.length > 0;

  return (
    <div className={styles.bar}>
      <div className={styles.search}>
        <SearchIcon className={styles.searchIcon} aria-hidden="true" />
        <input
          type="search"
          className={styles.searchInput}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {filters.map((filter) => (
        <span className={styles.anchor} key={filter.id}>
          <FilterChip
            filter={filter}
            fieldSource={sourceOf(filter.field)}
            onEdit={() => setEdit({ mode: "edit", filter })}
            onRemove={() => remove(filter.id)}
          />
          {edit.mode === "edit" && edit.filter.id === filter.id && (
            <FilterEditor
              fields={fields}
              initial={edit.filter}
              onApply={applyEdit}
              onCancel={() => setEdit({ mode: "closed" })}
            />
          )}
        </span>
      ))}

      <span className={styles.anchor}>
        <button
          type="button"
          className={styles.addBtn}
          disabled={!hasFields}
          aria-label="Add filter"
          aria-expanded={edit.mode === "add"}
          onClick={() =>
            setEdit((e) => (e.mode === "add" ? { mode: "closed" } : { mode: "add" }))
          }
        >
          {filters.length === 0 ? (
            <>
              <FilterIcon /> Filter
            </>
          ) : (
            <>
              <PlusIcon /> Add filter
            </>
          )}
        </button>
        {edit.mode === "add" && (
          <FilterEditor
            fields={fields}
            onApply={applyAdd}
            onCancel={() => setEdit({ mode: "closed" })}
          />
        )}
      </span>
    </div>
  );
}
