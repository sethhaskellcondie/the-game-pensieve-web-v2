"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import BeginnerHint from "@/components/BeginnerHint";
import Button from "@/components/Button";
import { PlusIcon } from "@/components/custom-fields/icons";
import { newFilterId } from "@/components/filters/ids";
import { useToast } from "@/components/ToastProvider";
import { UNCATEGORIZED_ID } from "@/lib/savedFilterCategories.types";
import type { StoredFilter } from "@/lib/savedFilters.types";
import CategorySection from "./CategorySection";
import SavedFilterCard from "./SavedFilterCard";
import SavedFilterDialog from "./SavedFilterDialog";
import { useDashboardSensors } from "./dndSensors";
import {
  findCategoryIndex,
  moveFilter as moveFilterTo,
} from "./dragReorder";
import type { FilterCategory, SavedFilter } from "./types";
import styles from "./SavedFiltersDashboard.module.css";

// The default name a freshly created category gets; renamed later on the edit
// screen.
const NEW_CATEGORY_NAME = "New Category";

// Detect drops by where the pointer is, not by which droppable's corners sit
// closest to the dragged card. An empty category's drop zone is short, so
// closestCorners tends to hand the drop to a neighbouring category's cards even
// when the cursor is squarely inside the empty one — pointerWithin makes the
// empty zone a first-class target. closestCorners is kept as the fallback for
// keyboard dragging, which has no pointer for pointerWithin to resolve.
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0
    ? pointerCollisions
    : closestCorners(args);
};

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

// Whether two row lists place the same filters in the same order under the same
// categories — used to skip a save when a drag ends where it began.
function sameArrangement(a: FilterCategory[], b: FilterCategory[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
    const fa = a[i].filters;
    const fb = b[i].filters;
    if (fa.length !== fb.length) return false;
    for (let j = 0; j < fa.length; j++) {
      if (fa[j].id !== fb[j].id) return false;
    }
  }
  return true;
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
  // The card riding the cursor (rendered in the DragOverlay), and the rows as
  // they were when the drag began — restored verbatim if the save fails.
  const [activeFilter, setActiveFilter] = useState<SavedFilter | null>(null);
  const dragSnapshot = useRef<FilterCategory[] | null>(null);
  const { showSnackbar } = useToast();

  // Per-input drag activation (mouse threshold, touch long-press, keyboard) —
  // see dndSensors.ts for the rationale behind each constraint.
  const sensors = useDashboardSensors();

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

  // Optimistically keep `next` (already applied to state by the drag handlers)
  // and persist only the filters store — a drag never touches the category list.
  // On failure, roll the whole board back to where the drag started.
  const commitFilters = async (
    next: FilterCategory[],
    snapshot: FilterCategory[],
  ) => {
    try {
      const res = await fetch("/api/saved-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toStoredFilters(next)),
      });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      setRows(snapshot);
      showSnackbar({
        message: "Couldn't save your changes. Please try again.",
        variant: "error",
      });
    }
  };

  // Drag lifecycle. A card is dragged to reorder it within its category or to
  // drop it into another one. We snapshot the board on start, shift the card
  // live across categories as it's dragged over them (within a category the
  // sortable strategy animates the gap on its own), and finalize its position on
  // drop. The save runs once on drop, only when something actually moved, and a
  // failed save rolls the board back to the snapshot.
  const onDragStart = (event: DragStartEvent) => {
    dragSnapshot.current = rows;
    const id = String(event.active.id);
    const filter = rows
      .flatMap((c) => c.filters)
      .find((f) => f.id === id);
    setActiveFilter(filter ?? null);
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setRows((prev) => {
      const from = findCategoryIndex(prev, activeId);
      const to = findCategoryIndex(prev, overId);
      // Cross-category hops are applied here; same-category shifting is left to
      // the sortable strategy so the two don't fight over the same frame.
      if (from < 0 || to < 0 || from === to) return prev;
      return moveFilterTo(prev, activeId, overId);
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveFilter(null);
    const snapshot = dragSnapshot.current;
    dragSnapshot.current = null;
    // Dropped outside any target: undo any live cross-category shift.
    if (!over) {
      if (snapshot) setRows(snapshot);
      return;
    }
    const activeId = String(active.id);
    const overId = String(over.id);
    let committed: FilterCategory[] | null = null;
    setRows((prev) => {
      committed = moveFilterTo(prev, activeId, overId);
      return committed;
    });
    if (committed && snapshot && !sameArrangement(committed, snapshot)) {
      void commitFilters(committed, snapshot);
    }
  };

  const onDragCancel = () => {
    setActiveFilter(null);
    if (dragSnapshot.current) setRows(dragSnapshot.current);
    dragSnapshot.current = null;
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
        <div className={styles.newCategoryWrap}>
          <Button className={styles.newCategoryBtn} onClick={onNewCategory}>
            <PlusIcon /> New Category
          </Button>
          <BeginnerHint
            placement="bottom-end"
            text="Here you can save filters to be shortcuts to different pages in the pensieve. These filters can be sorted in categories, after filters are created click and drag them to be in the categories and order that you like."
          />
        </div>
      </div>

      <DndContext
        // A stable id keeps dnd-kit's generated accessibility ids (the cards'
        // aria-describedby) deterministic, so the server and client agree on
        // them and the tree hydrates without a mismatch. Without it dnd-kit
        // falls back to an internal mount-order counter that differs per render.
        id="saved-filters-dnd"
        sensors={sensors}
        collisionDetection={collisionDetection}
        // Re-measure drop zones continuously through the drag. The default
        // (measure once at drag start) leaves an empty category's small
        // empty-state rect cached, so after a card is shifted in during
        // onDragOver the layout grows but the stale rect no longer sits under
        // the cursor — onDragEnd then sees no `over` and snaps the card back.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
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
        {/* The card clone that rides the cursor — no sortable wiring, just the
            lifted `overlay` look. (It re-resolves its own match count for the
            life of the drag, an abortable request that ends when it's dropped.) */}
        <DragOverlay>
          {activeFilter ? (
            <SavedFilterCard filter={activeFilter} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>

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
