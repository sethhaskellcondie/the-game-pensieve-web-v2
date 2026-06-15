"use client";

import { useState } from "react";
import Button from "@/components/Button";
import { PlusIcon } from "@/components/custom-fields/icons";
import { newFilterId } from "@/components/filters/ids";
import { useToast } from "@/components/ToastProvider";
import { UNCATEGORIZED_ID } from "@/lib/savedFilterCategories.types";
import CategorySection from "./CategorySection";
import type { FilterCategory } from "./types";
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

// Map the display rows to the stored { id, name, order } shape; order is the
// array index, matching how the backend re-derives it.
function toStored(rows: FilterCategory[]) {
  return rows.map((c, i) => ({ id: c.id, name: c.name, order: i }));
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
  const { showSnackbar } = useToast();

  const categoryCount = rows.length;
  const filterCount = rows.reduce((n, c) => n + c.filters.length, 0);

  // Optimistically show the new ordering, then persist the whole list. On
  // failure, revert to the previous rows and surface the error so the UI never
  // silently diverges from the backend.
  const persist = async (next: FilterCategory[]) => {
    const prev = rows;
    setRows(next);
    try {
      const res = await fetch("/api/saved-filter-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toStored(next)),
      });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      setRows(prev);
      showSnackbar({
        message: "Couldn't save categories. Please try again.",
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
    void persist(next);
  };

  // Rename / remove a real category.
  const onRenameCategory = (category: FilterCategory, name: string) => {
    void persist(rows.map((c) => (c.id === category.id ? { ...c, name } : c)));
  };
  const onDeleteCategory = (category: FilterCategory) => {
    void persist(rows.filter((c) => c.id !== category.id));
  };

  // Swap a row with its neighbor to reorder the displayed rows — works for any
  // row, including Uncategorized.
  const onMoveCategory = (category: FilterCategory, delta: -1 | 1) => {
    const index = rows.findIndex((c) => c.id === category.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next);
  };

  // TODO(saved-filters wiring): open the create/edit flows and persist changes.
  const onNewFilter = () => {};
  const onEditFilter = () => {};

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
              onRename={isUncategorized ? undefined : onRenameCategory}
              onDelete={isUncategorized ? undefined : onDeleteCategory}
              onMove={onMoveCategory}
              canMoveUp={i > 0}
              canMoveDown={i < rows.length - 1}
            />
          );
        })}
      </div>
    </div>
  );
}
