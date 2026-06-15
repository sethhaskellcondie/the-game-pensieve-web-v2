import type { EntityKey } from "@/lib/api";
import type { ActiveFilter } from "@/components/filters/types";

// One condition on a saved filter, rendered as a read-only pill on the card.
// It's an applied filter (the same shape the filter bar produces) plus the
// field's source so the glyph can be colored as standard vs. custom — the
// filter bar resolves that from its field list, but a saved filter is detached
// from any page so it carries the source with it.
export type SavedFilterCondition = ActiveFilter & {
  source: "standard" | "custom";
};

// A single saved filter — one card. It targets an entity page and pre-applies
// `conditions` there when opened, exactly as if they'd been entered by hand.
export type SavedFilter = {
  id: string;
  name: string;
  // Which collection page this opens (and whose icon/noun the card shows).
  entity: EntityKey;
  conditions: SavedFilterCondition[];
  // Result count shown as "{count} {noun}". Null until computed against the
  // backend (the count is derived data, not part of the saved definition).
  count: number | null;
};

// A named group of saved filters — one labeled row on the dashboard.
export type FilterCategory = {
  id: string;
  name: string;
  filters: SavedFilter[];
};

// The id of the always-present "Uncategorized" row — the home for saved filters
// not assigned to any category. It's a synthetic bucket, not a stored category,
// so it's keyed by this sentinel rather than a real record id.
export const UNCATEGORIZED_ID = "__uncategorized__";
