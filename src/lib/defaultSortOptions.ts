// Server-side access to the per-entity default sort options, persisted in the
// backend "metadata" store under the key `default_sort_options`. Uses the
// server-only API client (API_BASE_URL is not available in the browser), so
// this module must only be imported from Server Components and Route Handlers
// — Client Components should import shapes/defaults from
// "./defaultSortOptions.types" instead.

import { apiGetOrNull, apiPatch, apiPost } from "./api";
import { resolveActiveShowcase } from "./serverShowcase";
import {
  DEFAULT_SORT_OPTIONS_KEY,
  EMPTY_DEFAULT_SORT_OPTIONS,
  parseDefaultSortOptionsValue,
  serializeDefaultSortOptions,
  type DefaultSortOptions,
} from "./defaultSortOptions.types";

// The metadata record returned by GET/POST /metadata.
type MetadataRecord = {
  id: number;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const METADATA_PATH = `/metadata/${DEFAULT_SORT_OPTIONS_KEY}`;

// Creates the default_sort_options metadata entry with the given options.
async function createDefaultSortOptions(
  options: DefaultSortOptions,
): Promise<MetadataRecord> {
  return apiPost<MetadataRecord>("/metadata", {
    metadata: {
      id: null,
      key: DEFAULT_SORT_OPTIONS_KEY,
      value: serializeDefaultSortOptions(options),
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
    },
  });
}

// Persists updated options to the existing default_sort_options metadata entry.
export async function updateDefaultSortOptions(
  options: DefaultSortOptions,
): Promise<void> {
  await apiPatch<MetadataRecord>(METADATA_PATH, {
    value: serializeDefaultSortOptions(options),
  });
}

// Reads the default_sort_options metadata, creating it with no defaults if it
// does not yet exist. Never throws: if the backend is unreachable or returns
// garbage, it falls back to no defaults so the collection pages always render.
//
// While a public showcase is active the read is showcase-scoped (`X-Showcase`),
// so RLS returns the OWNER's default_sort_options row — a guest mirrors, and
// stays in sync with, whatever sort the owner has configured. A showcase view is
// scoped to the owner as GUEST and cannot write, so the create-if-missing branch
// is skipped there (an anonymous POST would be a doomed write into the owner's
// namespace); an owner with no row set just falls back to no defaults.
export async function loadDefaultSortOptions(): Promise<DefaultSortOptions> {
  try {
    const showcase = await resolveActiveShowcase();
    if (showcase && !showcase.stale) {
      const owners = await apiGetOrNull<MetadataRecord>(METADATA_PATH, {
        showcaseScoped: true,
      });
      return owners
        ? parseDefaultSortOptionsValue(owners.value)
        : { ...EMPTY_DEFAULT_SORT_OPTIONS };
    }

    const existing = await apiGetOrNull<MetadataRecord>(METADATA_PATH);
    if (existing) {
      return parseDefaultSortOptionsValue(existing.value);
    }

    const created = await createDefaultSortOptions(EMPTY_DEFAULT_SORT_OPTIONS);
    return parseDefaultSortOptionsValue(created.value);
  } catch {
    return { ...EMPTY_DEFAULT_SORT_OPTIONS };
  }
}
