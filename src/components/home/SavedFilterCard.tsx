import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
} from "@/components/custom-fields/icons";
import FieldGlyph from "@/components/filters/FieldGlyph";
import { operatorLabel } from "@/components/filters/operators";
import { encodeFilterParam, FILTERS_PARAM } from "@/components/filters/urlFilters";
import type { SavedFilterCondition, SavedFilter } from "./types";
import { ENTITY_ROUTES } from "./entityRoutes";
import styles from "./SavedFilterCard.module.css";

// The collection-page URL a card opens: its route, the list/shelf view for
// shared pages, and the conditions pre-applied via the `filters` param.
function hrefFor(filter: SavedFilter): string {
  const { route, view } = ENTITY_ROUTES[filter.entity];
  const params = new URLSearchParams();
  if (view) params.set("view", view);
  if (filter.conditions.length > 0) {
    params.set(FILTERS_PARAM, encodeFilterParam(filter.conditions));
  }
  const query = params.toString();
  return query ? `${route}?${query}` : route;
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
// collection page with these conditions pre-applied (the title link is
// stretched over the whole card). The trailing pencil floats above that link
// and opens the edit screen instead — the only place a saved filter is renamed,
// re-scoped, or deleted.
export default function SavedFilterCard({
  filter,
  onEdit,
  onMove,
  canMoveLeft = false,
  canMoveRight = false,
}: {
  filter: SavedFilter;
  onEdit?: (filter: SavedFilter) => void;
  // Reorder this filter within its category (−1 = earlier/left, +1 = later/
  // right). The flags disable each arrow at the row's ends.
  onMove?: (filter: SavedFilter, delta: -1 | 1) => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
}) {
  const { Icon, countNoun } = ENTITY_ROUTES[filter.entity];
  const href = hrefFor(filter);

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <span className={styles.entityIcon} aria-hidden="true">
          <Icon />
        </span>
        <Link href={href} className={styles.title}>
          {filter.name}
        </Link>
      </div>

      <div className={styles.pills}>
        {filter.conditions.map((condition) => (
          <ConditionPill key={condition.id} condition={condition} />
        ))}
      </div>

      <div className={styles.foot}>
        <span className={styles.count}>
          {filter.count == null ? "—" : filter.count} {countNoun}
        </span>
        <div className={styles.actions}>
          {onMove != null && (
            <>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`Move ${filter.name} left`}
                disabled={!canMoveLeft}
                onClick={() => onMove(filter, -1)}
              >
                <ChevronLeftIcon />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`Move ${filter.name} right`}
                disabled={!canMoveRight}
                onClick={() => onMove(filter, 1)}
              >
                <ChevronRightIcon />
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={`Edit ${filter.name}`}
            onClick={() => onEdit?.(filter)}
          >
            <PencilIcon />
          </button>
        </div>
      </div>
    </article>
  );
}
