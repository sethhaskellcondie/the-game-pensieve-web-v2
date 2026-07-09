"use client";

import { useState } from "react";
import { PlusIcon } from "@/components/custom-fields/icons";
import { FilterIcon, SearchIcon } from "@/components/toys/icons";
import BeginnerHint from "@/components/BeginnerHint";
import { useSession } from "@/components/auth/SessionProvider";
import FilterChip from "./FilterChip";
import FilterEditor from "./FilterEditor";
import SortControl from "./SortControl";
import { searchField, sortableFields } from "./fieldList";
import { newFilterId } from "./ids";
import type {
  ActiveFilter,
  ActiveSort,
  EntityKey,
  FilterFieldDef,
} from "./types";
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
  searchHint,
  sorts,
  onSortsChange,
  showFieldNames,
  onShowFieldNamesChange,
}: {
  entityKey: EntityKey;
  fields: FilterFieldDef[];
  filters: ActiveFilter[];
  onChange: (next: ActiveFilter[]) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  // Optional beginner hint shown beside the search box (only ever visible while
  // beginner mode is on). Opt-in so pages without search guidance stay clean.
  searchHint?: string;
  // Sort state, enabling the Sort button next to the Filter button. Optional so
  // entity pages adopt sorting one at a time (currently only Systems).
  sorts?: ActiveSort[];
  onSortsChange?: (next: ActiveSort[]) => void;
  // Mobile-only "Show field names" toggle, rendered in this row beside Sort and
  // Filter. Optional: only pages with a mobile CardList (which reads the flag)
  // pass it, so pages without cards stay clean.
  showFieldNames?: boolean;
  onShowFieldNamesChange?: (next: boolean) => void;
}) {
  const [edit, setEdit] = useState<EditState>({ mode: "closed" });

  // A lapsed account may list its data with an empty filter set, but any
  // non-empty filter returns 402 — so disable filtering (and quick-search, which
  // becomes a filter) for them. Guests and Paid users can filter.
  const { canFilter } = useSession();

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

  // Enter in the search box turns the typed text into a "name contains" chip and
  // clears the box, so a quick search becomes an explicit, editable filter.
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    if (!canFilter) return;
    const text = searchValue.trim();
    const sf = searchField(fields);
    if (text === "" || !sf) return;
    e.preventDefault();
    onChange([
      ...filters,
      {
        id: newFilterId(),
        field: sf.field,
        label: sf.label,
        kind: "text",
        operator: "contains",
        operand: text,
      },
    ]);
    onSearchChange("");
  };

  const hasFields = fields.length > 0;

  return (
    <div className={styles.bar}>
      {/* Chips fill the space after the toy count, wrapping among themselves
          without pushing the search/filter controls off their line. */}
      <div className={styles.chips}>
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
      </div>

      {/* Search + filter button are pinned to the right (before the New button). */}
      <div className={styles.controls}>
        <div className={styles.search}>
          <SearchIcon className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
            disabled={!canFilter}
          />
        </div>

        {searchHint != null && (
          <BeginnerHint placement="bottom-end" text={searchHint} />
        )}

        {/* Mobile-only display toggle (hidden on desktop via CSS, where the
            table already shows field names as column headers). Leads the Sort
            and Filter buttons in the same row. */}
        {showFieldNames != null && onShowFieldNamesChange != null && (
          <button
            type="button"
            className={`${styles.addBtn} ${styles.mobileOnly}`}
            aria-pressed={showFieldNames}
            onClick={() => onShowFieldNamesChange(!showFieldNames)}
          >
            Show field names
          </button>
        )}

        {sorts != null && onSortsChange != null && (
          <SortControl
            fields={sortableFields(fields)}
            sorts={sorts}
            onChange={onSortsChange}
            buttonClassName={styles.addBtn}
          />
        )}

        <span className={styles.anchor}>
          <button
            type="button"
            className={styles.addBtn}
            disabled={!hasFields || !canFilter}
            aria-label="Add filter"
            aria-expanded={edit.mode === "add"}
            title={
              !canFilter
                ? "Filtering requires an active subscription"
                : undefined
            }
            onClick={() =>
              setEdit((e) =>
                e.mode === "add" ? { mode: "closed" } : { mode: "add" },
              )
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
          {canFilter && edit.mode === "add" && (
            <FilterEditor
              fields={fields}
              align="right"
              onApply={applyAdd}
              onCancel={() => setEdit({ mode: "closed" })}
            />
          )}
        </span>
      </div>
    </div>
  );
}
