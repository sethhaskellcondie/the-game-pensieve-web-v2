"use client";

import { useState } from "react";
import Button from "@/components/Button";
import { PlusIcon } from "@/components/custom-fields/icons";
import CategorySection from "./CategorySection";
import { UNCATEGORIZED_ID, type FilterCategory, type SavedFilter } from "./types";
import styles from "./SavedFiltersDashboard.module.css";

// "3 categories, and 16 saved filters." — pluralized, with 0 reading naturally.
function summary(categoryCount: number, filterCount: number): string {
  const cats = `${categoryCount} ${categoryCount === 1 ? "category" : "categories"}`;
  const filters = `${filterCount} saved ${filterCount === 1 ? "filter" : "filters"}`;
  return `${cats}, and ${filters}.`;
}

// The home dashboard of saved filters: a greeting + counts, a "New Category"
// action, and one horizontally-scrolling row of cards per category. Owns the
// category list as state so the create/edit flows (wired later) can mutate it.
// The "Uncategorized" row is always rendered last as the home for filters with
// no category, so there's never a truly empty page — hence no all-categories
// empty state.
export default function SavedFiltersDashboard({
  initialCategories,
  initialUncategorized = [],
}: {
  initialCategories: FilterCategory[];
  // Saved filters not assigned to any category — shown in the Uncategorized row.
  initialUncategorized?: SavedFilter[];
}) {
  const [categories] = useState<FilterCategory[]>(initialCategories);
  const [uncategorized] = useState<SavedFilter[]>(initialUncategorized);

  // The Uncategorized bucket renders like any other category but always exists
  // and always sorts last.
  const rows: FilterCategory[] = [
    ...categories,
    { id: UNCATEGORIZED_ID, name: "Uncategorized", filters: uncategorized },
  ];
  const filterCount = rows.reduce((n, c) => n + c.filters.length, 0);

  // TODO(saved-filters wiring): open the create/edit flows and persist to the
  // metadata table. Stubbed so the UI is complete and interactive-looking.
  const onNewCategory = () => {};
  const onNewFilter = () => {};
  const onEditFilter = () => {};

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div className={styles.greeting}>
          <h2 className={styles.title}>Welcome back!</h2>
          <p className={styles.summary}>{summary(rows.length, filterCount)}</p>
        </div>
        <Button className={styles.newCategoryBtn} onClick={onNewCategory}>
          <PlusIcon /> New Category
        </Button>
      </div>

      <div className={styles.categories}>
        {rows.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            onNewFilter={onNewFilter}
            onEditFilter={onEditFilter}
          />
        ))}
      </div>
    </div>
  );
}
