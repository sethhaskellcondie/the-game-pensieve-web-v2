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
// `conditions` there when opened, exactly as if they'd been entered by hand. The
// match count shown on the card is derived live from these conditions (see
// useMatchCount), not stored.
export type SavedFilter = {
  id: string;
  name: string;
  // Which collection page this opens (and whose icon/noun the card shows).
  entity: EntityKey;
  conditions: SavedFilterCondition[];
};

// A named group of saved filters — one labeled row on the dashboard.
export type FilterCategory = {
  id: string;
  name: string;
  filters: SavedFilter[];
};

// Re-exported from the persistence layer so the UI and the metadata store agree
// on the Uncategorized row's reserved id.
export { UNCATEGORIZED_ID } from "@/lib/savedFilterCategories.types";
