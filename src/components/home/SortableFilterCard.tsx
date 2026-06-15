"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SavedFilterCard from "./SavedFilterCard";
import type { SavedFilter } from "./types";

// Wraps a saved-filter card in dnd-kit's sortable behavior: the card becomes
// both a drag source and a drop target keyed by its filter id (the same id
// dragReorder resolves). The whole card is the handle — listeners/attributes
// and the live transform are threaded straight onto the card element. While a
// card is being dragged its original is hidden (`dragging`) and a clone follows
// the cursor in the dashboard's DragOverlay.
export default function SortableFilterCard({
  filter,
  onEdit,
}: {
  filter: SavedFilter;
  onEdit?: (filter: SavedFilter) => void;
}) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: filter.id });

  return (
    <SavedFilterCard
      filter={filter}
      onEdit={onEdit}
      nodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      handleProps={{ ...attributes, ...listeners }}
      dragging={isDragging}
    />
  );
}
