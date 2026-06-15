"use client";

import { useState } from "react";
import Button from "@/components/Button";
import { PlusIcon } from "@/components/custom-fields/icons";
import { newFilterId } from "@/components/filters/ids";
import { useToast } from "@/components/ToastProvider";
import { UNCATEGORIZED_ID } from "@/lib/savedFilterCategories.types";
import type { StoredFilter } from "@/lib/savedFilters.types";
import CategorySection from "./CategorySection";
import SavedFilterDialog from "./SavedFilterDialog";
import type { FilterCategory, SavedFilter } from "./types";
import styles from "./SavedFiltersDashboard.module.css";

// The default name a freshly created category gets; renamed later on the edit
// screen.
const NEW_CATEGORY_NAME = "New Category";

// "3 categories, and 16 saved filters." — pluralized, with 0 reading naturally.
function summary(categoryCount: number, filterCount: number): string {
  const cats = `${categoryCount} ${categoryCount === 1 ? "category" : "categories"}`;
  const filters = `${filterCount} saved ${filterCount === 1 ? "filter" : "filters"}`;
  return `${cats}, and ${filters}.`;
}

// The `rows` view (categories each holding an ordered filter list) is the single
// in-session source of truth; both backend stores are derived from it. A
// category's index is its order; a filter's category is the row it sits in and
// its order is its index there.
function toStoredCategories(rows: FilterCategory[]) {
  return rows.map((c, i) => ({ id: c.id, name: c.name, order: i }));
}

function toStoredFilters(rows: FilterCategory[]): StoredFilter[] {
  return rows.flatMap((c) =>
    c.filters.map((f, j) => ({
      id: f.id,
      name: f.name,
      entity: f.entity,
      categoryId: c.id,
      order: j,
      conditions: f.conditions.map((cond) => ({
        id: cond.id,
        field: cond.field,
        label: cond.label,
        kind: cond.kind,
        source: cond.source,
        operator: cond.operator,
        operand: cond.operand,
        ...(cond.operandLabel != null
          ? { operandLabel: cond.operandLabel }
          : {}),
      })),
    })),
  );
}

// The home dashboard of saved filters: a greeting + counts, a "New Category"
// action, and one horizontally-scrolling row of cards per category. Owns the
// ordered row list as state and persists every change to the metadata-backed
// store. The "Uncategorized" row is one of these rows — always present (so
// there's never a truly empty page, hence no all-categories empty state) and
// reorderable like the rest, but never renamed or deleted.
export default function SavedFiltersDashboard({
  initialCategories,
}: {
  // The full ordered list, including the Uncategorized row, as loaded from the
  // backend on the server.
  initialCategories: FilterCategory[];
}) {
  const [rows, setRows] = useState<FilterCategory[]>(initialCategories);
  // Which saved filter is being created or edited, plus its owning category.
  // `filter` is set in edit mode, absent when creating a new one.
  const [filterDialog, setFilterDialog] = useState<{
    category: FilterCategory;
    filter?: SavedFilter;
  } | null>(null);
  const { showSnackbar } = useToast();

  // The summary counts only real categories — the always-present Uncategorized
  // row is a catch-all bucket, not a category the user created.
  const categoryCount = rows.filter((c) => c.id !== UNCATEGORIZED_ID).length;
  const filterCount = rows.reduce((n, c) => n + c.filters.length, 0);

  // Optimistically apply the new rows, then persist whichever store(s) the change
  // touched. On failure, revert and surface the error so the UI never silently
  // diverges from the backend.
  const persist = async (
    next: FilterCategory[],
    stores: { categories?: boolean; filters?: boolean },
  ) => {
    const prev = rows;
    setRows(next);
    const post = (path: string, body: unknown) =>
      fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    try {
      const requests: Promise<Response>[] = [];
      if (stores.categories) {
        requests.push(
          post("/api/saved-filter-categories", toStoredCategories(next)),
        );
      }
      if (stores.filters) {
        requests.push(post("/api/saved-filters", toStoredFilters(next)));
      }
      const results = await Promise.all(requests);
      if (results.some((r) => !r.ok)) throw new Error("Request failed");
    } catch {
      setRows(prev);
      showSnackbar({
        message: "Couldn't save your changes. Please try again.",
        variant: "error",
      });
    }
  };

  // Add an empty, default-named category just above the Uncategorized row (its
  // default home), renamed and filled in later.
  const onNewCategory = () => {
    const newCat: FilterCategory = {
      id: newFilterId(),
      name: NEW_CATEGORY_NAME,
      filters: [],
    };
    const uIndex = rows.findIndex((c) => c.id === UNCATEGORIZED_ID);
    const next = [...rows];
    if (uIndex < 0) next.push(newCat);
    else next.splice(uIndex, 0, newCat);
    void persist(next, { categories: true });
  };

  // Rename a real category.
  const onRenameCategory = (category: FilterCategory, name: string) => {
    void persist(
      rows.map((c) => (c.id === category.id ? { ...c, name } : c)),
      { categories: true },
    );
  };

  // Delete a real category; its filters aren't lost — they fall back to the
  // Uncategorized row (so both stores change when the category held filters).
  const onDeleteCategory = (category: FilterCategory) => {
    const orphaned = rows.find((c) => c.id === category.id)?.filters ?? [];
    const next = rows
      .filter((c) => c.id !== category.id)
      .map((c) =>
        c.id === UNCATEGORIZED_ID
          ? { ...c, filters: [...c.filters, ...orphaned] }
          : c,
      );
    void persist(next, { categories: true, filters: orphaned.length > 0 });
  };

  // Swap a row with its neighbor to reorder the displayed rows — works for any
  // row, including Uncategorized.
  const onMoveCategory = (category: FilterCategory, delta: -1 | 1) => {
    const index = rows.findIndex((c) => c.id === category.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next, { categories: true });
  };

  // Open the dialog to create a filter in this category, or to edit an existing
  // one (found by walking the rows for its id).
  const onNewFilter = (category: FilterCategory) => {
    setFilterDialog({ category });
  };
  const onEditFilter = (filter: SavedFilter) => {
    const category = rows.find((c) =>
      c.filters.some((f) => f.id === filter.id),
    );
    if (category) setFilterDialog({ category, filter });
  };

  // Create, update, or move a saved filter. It's removed from any category it
  // was in, then placed in `categoryId` — replaced in place if it already lived
  // there (preserving its order), otherwise appended to that category's end.
  const saveFilter = (saved: SavedFilter, categoryId: string) => {
    const next = rows.map((c) => {
      if (c.id === categoryId) {
        const index = c.filters.findIndex((f) => f.id === saved.id);
        if (index >= 0) {
          const filters = [...c.filters];
          filters[index] = saved;
          return { ...c, filters };
        }
        return {
          ...c,
          filters: [...c.filters.filter((f) => f.id !== saved.id), saved],
        };
      }
      return { ...c, filters: c.filters.filter((f) => f.id !== saved.id) };
    });
    void persist(next, { filters: true });
  };

  const deleteFilter = (filterId: string) => {
    void persist(
      rows.map((c) => ({
        ...c,
        filters: c.filters.filter((f) => f.id !== filterId),
      })),
      { filters: true },
    );
  };

  // Reorder a filter within its category (cards run left→right).
  const moveFilter = (
    category: FilterCategory,
    filter: SavedFilter,
    delta: -1 | 1,
  ) => {
    const next = rows.map((c) => {
      if (c.id !== category.id) return c;
      const index = c.filters.findIndex((f) => f.id === filter.id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= c.filters.length) return c;
      const filters = [...c.filters];
      [filters[index], filters[target]] = [filters[target], filters[index]];
      return { ...c, filters };
    });
    void persist(next, { filters: true });
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div className={styles.greeting}>
          <h2 className={styles.title}>Welcome back!</h2>
          <p className={styles.summary}>
            {summary(categoryCount, filterCount)}
          </p>
        </div>
        <Button className={styles.newCategoryBtn} onClick={onNewCategory}>
          <PlusIcon /> New Category
        </Button>
      </div>

      <div className={styles.categories}>
        {rows.map((category, i) => {
          // Uncategorized is reorderable like the rest, but never renamed or
          // deleted — so it gets onMove but no onRename/onDelete (no pencil).
          const isUncategorized = category.id === UNCATEGORIZED_ID;
          return (
            <CategorySection
              key={category.id}
              category={category}
              onNewFilter={onNewFilter}
              onEditFilter={onEditFilter}
              onMoveFilter={moveFilter}
              onRename={isUncategorized ? undefined : onRenameCategory}
              onDelete={isUncategorized ? undefined : onDeleteCategory}
              onMove={onMoveCategory}
              canMoveUp={i > 0}
              canMoveDown={i < rows.length - 1}
            />
          );
        })}
      </div>

      {filterDialog && (
        <SavedFilterDialog
          initial={filterDialog.filter}
          categories={rows.map((c) => ({ id: c.id, name: c.name }))}
          initialCategoryId={filterDialog.category.id}
          onSave={saveFilter}
          onDelete={
            filterDialog.filter
              ? () => deleteFilter(filterDialog.filter!.id)
              : undefined
          }
          onClose={() => setFilterDialog(null)}
        />
      )}
    </div>
  );
}
