"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  CaretIcon,
  PencilIcon,
  PlusIcon,
} from "@/components/custom-fields/icons";
import { FilterIcon } from "@/components/toys/icons";
import SortableFilterCard from "./SortableFilterCard";
import CategoryEditDialog from "./CategoryEditDialog";
import { containerId } from "./dragReorder";
import type { FilterCategory, SavedFilter } from "./types";
import styles from "./CategorySection.module.css";

// One category: a blue grid header bar (name + "New filter" + filter count) over
// a horizontally scrolling row of its saved-filter cards. Cards are dragged to
// reorder within the row or to move into another category; the body is a
// droppable so a card can be dropped onto an empty category or past the last
// card. Real categories also get hover-revealed header controls — reorder arrows
// and an edit pencil (rename / delete) — while the synthetic Uncategorized row
// omits onRename/onDelete/onMove so it shows none.
export default function CategorySection({
  category,
  onNewFilter,
  onEditFilter,
  onRename,
  onDelete,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
}: {
  category: FilterCategory;
  onNewFilter?: (category: FilterCategory) => void;
  onEditFilter?: (filter: SavedFilter) => void;
  onRename?: (category: FilterCategory, name: string) => void;
  onDelete?: (category: FilterCategory) => void;
  // Reorder this category among its siblings (−1 = up, +1 = down). The flags say
  // whether each direction is in range, so the arrows can disable at the bounds.
  onMove?: (category: FilterCategory, delta: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const count = category.filters.length;
  const editable = onRename != null && onDelete != null;
  const [editing, setEditing] = useState(false);
  // The whole card row is a drop target so empty categories (and the padding
  // past the last card) still accept a dragged card.
  const { setNodeRef } = useDroppable({ id: containerId(category.id) });

  return (
    <section className={styles.category} aria-label={category.name}>
      <div className={styles.head}>
        <div className={styles.titleWrap}>
          <h3 className={styles.name}>{category.name}</h3>
          {onMove != null && (
            <>
              <button
                type="button"
                className={styles.headBtn}
                aria-label={`Move ${category.name} up`}
                disabled={!canMoveUp}
                onClick={() => onMove(category, -1)}
              >
                <CaretIcon className={styles.caretUp} />
              </button>
              <button
                type="button"
                className={styles.headBtn}
                aria-label={`Move ${category.name} down`}
                disabled={!canMoveDown}
                onClick={() => onMove(category, 1)}
              >
                <CaretIcon />
              </button>
            </>
          )}
          {editable && (
            <button
              type="button"
              className={styles.headBtn}
              aria-label={`Edit ${category.name}`}
              onClick={() => setEditing(true)}
            >
              <PencilIcon />
            </button>
          )}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.newFilterBtn}
            onClick={() => onNewFilter?.(category)}
          >
            <PlusIcon /> New filter
          </button>
          <span className={styles.count}>
            {count} {count === 1 ? "filter" : "filters"}
          </span>
        </div>
      </div>

      <div ref={setNodeRef} className={styles.body}>
        <SortableContext
          items={category.filters.map((f) => f.id)}
          strategy={horizontalListSortingStrategy}
        >
          {count === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <FilterIcon />
              </span>
              <p className={styles.emptyText}>
                No saved filters in this category yet.
              </p>
              <button
                type="button"
                className={styles.emptyBtn}
                onClick={() => onNewFilter?.(category)}
              >
                <PlusIcon /> Add a filter
              </button>
            </div>
          ) : (
            <div className={styles.row}>
              {category.filters.map((filter) => (
                <SortableFilterCard
                  key={filter.id}
                  filter={filter}
                  onEdit={onEditFilter}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </div>

      {editable && editing && (
        <CategoryEditDialog
          category={category}
          onRename={(name) => onRename?.(category, name)}
          onDelete={() => onDelete?.(category)}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}
