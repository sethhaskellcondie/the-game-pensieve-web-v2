// Server-side access to the saved-filter categories, persisted in the backend
// "metadata" store under the key `saved-filter-categories`. Uses the server-only
// API client (API_BASE_URL is not available in the browser), so this module must
// only be imported from Server Components and Route Handlers — Client Components
// should import shapes/helpers from "./savedFilterCategories.types" instead.

import { apiGetOrNull, apiPatch, apiPost } from "./api";
import {
  SAVED_FILTER_CATEGORIES_KEY,
  DEFAULT_SAVED_FILTER_CATEGORIES,
  normalizeCategories,
  parseSavedFilterCategoriesValue,
  serializeSavedFilterCategories,
  type StoredCategory,
} from "./savedFilterCategories.types";

// The metadata record returned by GET/POST /metadata (see openapi.yaml).
type MetadataRecord = {
  id: number;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const METADATA_PATH = `/metadata/${SAVED_FILTER_CATEGORIES_KEY}`;

// Creates the saved-filter-categories metadata entry with the given categories.
async function createSavedFilterCategories(
  categories: StoredCategory[],
): Promise<MetadataRecord> {
  return apiPost<MetadataRecord>("/metadata", {
    metadata: {
      id: null,
      key: SAVED_FILTER_CATEGORIES_KEY,
      value: serializeSavedFilterCategories(categories),
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
    },
  });
}

// Persists the full category list to the existing metadata entry. Order is
// derived from array position by serializeSavedFilterCategories.
export async function updateSavedFilterCategories(
  categories: StoredCategory[],
): Promise<void> {
  await apiPatch<MetadataRecord>(METADATA_PATH, {
    value: serializeSavedFilterCategories(categories),
  });
}

// Reads the saved-filter categories, creating the entry (with just the
// Uncategorized row) if it does not yet exist. Never throws: if the backend is
// unreachable or returns garbage, it falls back to the default so the home page
// always renders.
export async function loadSavedFilterCategories(): Promise<StoredCategory[]> {
  try {
    const existing = await apiGetOrNull<MetadataRecord>(METADATA_PATH);
    if (existing) {
      return parseSavedFilterCategoriesValue(existing.value);
    }

    const created = await createSavedFilterCategories(
      DEFAULT_SAVED_FILTER_CATEGORIES,
    );
    return parseSavedFilterCategoriesValue(created.value);
  } catch {
    return normalizeCategories([]);
  }
}
