// Server-side access to the saved filters, persisted in the backend "metadata"
// store under the key `saved-filters`. Uses the server-only API client
// (API_BASE_URL is not available in the browser), so this module must only be
// imported from Server Components and Route Handlers — Client Components should
// import shapes/helpers from "./savedFilters.types" instead.

import { apiGetOrNull, apiPatch, apiPost } from "./api";
import {
  SAVED_FILTERS_KEY,
  DEFAULT_SAVED_FILTERS,
  normalizeFilters,
  parseSavedFiltersValue,
  serializeSavedFilters,
  type StoredFilter,
} from "./savedFilters.types";

// The metadata record returned by GET/POST /metadata (see openapi.yaml).
type MetadataRecord = {
  id: number;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const METADATA_PATH = `/metadata/${SAVED_FILTERS_KEY}`;

// Creates the saved-filters metadata entry with the given filters.
async function createSavedFilters(
  filters: StoredFilter[],
): Promise<MetadataRecord> {
  return apiPost<MetadataRecord>("/metadata", {
    metadata: {
      id: null,
      key: SAVED_FILTERS_KEY,
      value: serializeSavedFilters(filters),
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
    },
  });
}

// Persists the full saved-filter list to the existing metadata entry.
export async function updateSavedFilters(
  filters: StoredFilter[],
): Promise<void> {
  await apiPatch<MetadataRecord>(METADATA_PATH, {
    value: serializeSavedFilters(filters),
  });
}

// Reads the saved filters, creating the (empty) entry if it does not yet exist.
// Never throws: if the backend is unreachable or returns garbage, it falls back
// to an empty list so the home page always renders.
export async function loadSavedFilters(): Promise<StoredFilter[]> {
  try {
    const existing = await apiGetOrNull<MetadataRecord>(METADATA_PATH);
    if (existing) {
      return parseSavedFiltersValue(existing.value);
    }

    const created = await createSavedFilters(DEFAULT_SAVED_FILTERS);
    return parseSavedFiltersValue(created.value);
  } catch {
    return normalizeFilters([]);
  }
}
