import {
  fetchEntityFields,
  fetchFilterSpec,
  searchSystemsClient,
} from "@/components/video-games/searchClient";
import { buildFieldList, supportsSorting } from "@/components/filters/fieldList";
import type { FilterFieldDef } from "@/components/filters/types";
import type { EntityKey } from "@/lib/api";

// What the saved-filter dialog needs about an entity: the fields it can build
// conditions and sort levels from, and whether the entity's spec advertises
// sorting at all (the sort control is hidden when it doesn't).
export type EntityFilterFields = {
  fields: FilterFieldDef[];
  canSort: boolean;
};

// Build the filter field list for an entity the same way the collection pages
// do: merge the backend filter spec (standard filterable fields + operators)
// with the entity's custom fields, then give the system field the systems list
// as value/label choices so it filters by name while sending ids. Used by the
// saved-filter dialog, whose entity is user-selectable.
export async function fetchEntityFilterFields(
  entity: EntityKey,
  signal?: AbortSignal,
): Promise<EntityFilterFields> {
  const [spec, defs, systems] = await Promise.all([
    fetchFilterSpec(entity, signal),
    fetchEntityFields(entity, signal),
    searchSystemsClient(signal),
  ]);
  const fields = buildFieldList(spec, defs).map((f) =>
    f.kind === "system"
      ? {
          ...f,
          label: "System",
          valueOptions: systems.map((s) => ({
            value: String(s.id),
            label: s.name,
          })),
        }
      : f,
  );
  return { fields, canSort: supportsSorting(spec) };
}
