"use client";

import type { CSSProperties, HTMLAttributes, Ref } from "react";
import Link from "next/link";
import { PencilIcon } from "@/components/custom-fields/icons";
import FieldGlyph from "@/components/filters/FieldGlyph";
import { operatorLabel } from "@/components/filters/operators";
import {
  encodeFilterParam,
  encodeSortParam,
  FILTERS_PARAM,
  SORTS_PARAM,
} from "@/components/filters/urlFilters";
import type { ActiveSort } from "@/components/filters/types";
import type { SavedFilterCondition, SavedFilter } from "./types";
import { ENTITY_ROUTES } from "./entityRoutes";
import { useMatchCount } from "./matchCount";
import styles from "./SavedFilterCard.module.css";

// The collection-page URL a card opens: its route, the list/shelf view for
// shared pages, the conditions pre-applied via the `filters` param, and the sort
// levels via `sorts`. A filter that saved no sorting omits the param entirely —
// non-empty wins, exactly as with the conditions — so the page keeps whatever
// sort it remembers (or the entity default) instead of being cleared.
function hrefFor(filter: SavedFilter): string {
  const { route, view } = ENTITY_ROUTES[filter.entity];
  const params = new URLSearchParams();
  if (view) params.set("view", view);
  if (filter.conditions.length > 0) {
    params.set(FILTERS_PARAM, encodeFilterParam(filter.conditions));
  }
  if (filter.sorts.length > 0) {
    params.set(SORTS_PARAM, encodeSortParam(filter.sorts));
  }
  const query = params.toString();
  return query ? `${route}?${query}` : route;
}

// How one sort level reads to assistive tech ("Release Date descending"); the
// pill itself shows an arrow instead.
function sortLabel(sort: ActiveSort): string {
  return `${sort.label} ${sort.direction === "asc" ? "ascending" : "descending"}`;
}

// How a condition's value reads on its pill: an id operand shows its
// snapshotted label, a boolean reads Yes/No, everything else shows raw.
// Mirrors FilterChip.displayOperand so saved filters and live filters match.
function displayOperand(c: SavedFilterCondition): string {
  if (c.operandLabel) return c.operandLabel;
  if (c.kind === "boolean") return c.operand === "true" ? "Yes" : "No";
  return c.operand;
}

// One read-only condition pill: colored field glyph, field label, operator,
// value. No edit/remove controls — the whole card is a single link, so a pill
// is purely a display of what the saved filter matches.
function ConditionPill({ condition }: { condition: SavedFilterCondition }) {
  return (
    <span className={styles.pill}>
      <FieldGlyph
        field={{
          field: condition.field,
          label: condition.label,
          kind: condition.kind,
          source: condition.source,
          operators: [],
          options: condition.options,
        }}
      />
      <span className={styles.pillLabel}>{condition.label}</span>
      <span className={styles.pillOp}>{operatorLabel(condition.operator)}</span>
      <span className={styles.pillVal}>{displayOperand(condition)}</span>
    </span>
  );
}

// A saved-filter card. Clicking anywhere on the card opens the target
// collection page with these conditions pre-applied and these sort levels in
// effect (the title link is stretched over the whole card). The trailing pencil floats above that link
// and opens the edit screen instead — the only place a saved filter is renamed,
// re-scoped, or deleted.
//
// The whole card is also the drag handle: SortableFilterCard threads the dnd-kit
// node ref, transform style, and pointer listeners through `nodeRef`, `style`,
// and `handleProps`. A short drag-activation distance keeps a plain click on the
// title working as a link. The same card renders statically in the DragOverlay
// (no drag props), so all of those are optional.
export default function SavedFilterCard({
  filter,
  onEdit,
  nodeRef,
  style,
  handleProps,
  dragging = false,
  overlay = false,
}: {
  filter: SavedFilter;
  onEdit?: (filter: SavedFilter) => void;
  // dnd-kit wiring, supplied only by the sortable wrapper.
  nodeRef?: Ref<HTMLElement>;
  style?: CSSProperties;
  handleProps?: HTMLAttributes<HTMLElement>;
  // The original card while its clone rides the cursor (hidden); the floating
  // clone itself reads `overlay`.
  dragging?: boolean;
  overlay?: boolean;
}) {
  const { Icon, countNoun } = ENTITY_ROUTES[filter.entity];
  const href = hrefFor(filter);
  // Live count of records this filter matches; "—" until it resolves.
  const count = useMatchCount(filter.entity, filter.conditions);

  return (
    <article
      ref={nodeRef}
      style={style}
      className={`${styles.card}${dragging ? ` ${styles.dragging}` : ""}${
        overlay ? ` ${styles.overlay}` : ""
      }`}
      {...handleProps}
    >
      <div className={styles.head}>
        <span className={styles.entityIcon} aria-hidden="true">
          <Icon />
        </span>
        <Link href={href} className={styles.title} draggable={false}>
          {filter.name}
        </Link>
      </div>

      <div className={styles.pills}>
        {filter.conditions.map((condition) => (
          <ConditionPill key={condition.id} condition={condition} />
        ))}
      </div>

      {filter.sorts.length > 0 && (
        <div className={styles.sorts}>
          <span className={styles.sortsLabel}>Sorted by</span>
          {filter.sorts.map((sort) => (
            <span
              key={sort.id}
              className={styles.sortPill}
              aria-label={sortLabel(sort)}
            >
              <span className={styles.sortDir} aria-hidden="true">
                {sort.direction === "asc" ? "↑" : "↓"}
              </span>
              {sort.label}
            </span>
          ))}
        </div>
      )}

      <div className={styles.foot}>
        <span className={styles.count}>
          {count == null ? "—" : count} {countNoun}
        </span>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={`Edit ${filter.name}`}
            onClick={() => onEdit?.(filter)}
            // The card is a drag handle; keep the pencil a plain click, not a
            // drag start, and keep it off the stretched title link.
            onPointerDown={(e) => e.stopPropagation()}
          >
            <PencilIcon />
          </button>
        </div>
      </div>
    </article>
  );
}
