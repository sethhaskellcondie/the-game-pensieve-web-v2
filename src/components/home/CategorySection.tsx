"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  CaretIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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

  // Prev/next scroll arrows (shown on mobile — see CSS) for nudging the row one
  // card at a time. We track whether the row can still scroll each way so the
  // arrows disable at the ends and hide entirely when nothing overflows.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // One card (SavedFilterCard is a fixed 232px) plus the row's 14px gap.
  const CARD_STEP = 246;

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 1px slack absorbs sub-pixel rounding at the extremes.
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // Merge our scroll ref with dnd-kit's droppable ref onto the same node.
  const setBodyRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  // Recompute on mount, on scroll, on viewport resize, and whenever the card
  // count changes (which alters the scrollable width).
  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (el == null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateScrollState, count]);

  const scrollByCard = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({
      left: direction * CARD_STEP,
      behavior: "smooth",
    });
  };

  const showArrows = canScrollLeft || canScrollRight;

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

      <div className={styles.bodyWrap}>
        <div
          ref={setBodyRef}
          className={styles.body}
          onScroll={updateScrollState}
        >
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

        {/* Mobile scroll arrows (hidden on desktop via CSS). Rendered only when
            the row overflows; each disables at its end of the scroll range. */}
        {showArrows && (
          <>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navLeft}`}
              aria-label={`Scroll ${category.name} filters left`}
              disabled={!canScrollLeft}
              onClick={() => scrollByCard(-1)}
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navRight}`}
              aria-label={`Scroll ${category.name} filters right`}
              disabled={!canScrollRight}
              onClick={() => scrollByCard(1)}
            >
              <ChevronRightIcon />
            </button>
          </>
        )}
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
