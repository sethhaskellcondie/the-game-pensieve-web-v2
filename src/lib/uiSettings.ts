// Server-side access to the app's UI settings, persisted in the backend
// "metadata" store under the key `ui-settings`. Uses the server-only API client
// (API_BASE_URL is not available in the browser), so this module must only be
// imported from Server Components and Route Handlers — Client Components should
// import shapes/defaults from "./uiSettings.types" instead.

import { apiGetOrNull, apiPatch, apiPost } from "./api";
import { resolveActiveShowcase } from "./serverShowcase";
import {
  DEFAULT_UI_SETTINGS,
  UI_SETTINGS_KEY,
  parseUiSettingsValue,
  serializeUiSettings,
  type UiSettings,
} from "./uiSettings.types";

// The metadata record returned by GET/POST /metadata.
type MetadataRecord = {
  id: number;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const METADATA_PATH = `/metadata/${UI_SETTINGS_KEY}`;

// Creates the ui-settings metadata entry with the given settings.
async function createUiSettings(settings: UiSettings): Promise<MetadataRecord> {
  return apiPost<MetadataRecord>("/metadata", {
    metadata: {
      id: null,
      key: UI_SETTINGS_KEY,
      value: serializeUiSettings(settings),
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
    },
  });
}

// Persists updated settings to the existing ui-settings metadata entry.
export async function updateUiSettings(settings: UiSettings): Promise<void> {
  await apiPatch<MetadataRecord>(METADATA_PATH, {
    value: serializeUiSettings(settings),
  });
}

// Reads the ui-settings metadata, creating it with all-false defaults if it does
// not yet exist. Never throws: if the backend is unreachable or returns garbage,
// it falls back to the defaults so the app always renders.
//
// While a public showcase is active the read is showcase-scoped (`X-Showcase`),
// so the backend serves the fixed guest ui-settings for that read-only view
// instead of the viewer's own. A showcase view is scoped to the owner as GUEST
// and cannot write, so the create-if-missing branch is skipped there (an
// anonymous POST would be a doomed write into the owner's namespace).
export async function loadUiSettings(): Promise<UiSettings> {
  try {
    const showcase = await resolveActiveShowcase();
    if (showcase && !showcase.stale) {
      const guest = await apiGetOrNull<MetadataRecord>(METADATA_PATH, {
        showcaseScoped: true,
      });
      return guest
        ? parseUiSettingsValue(guest.value)
        : { ...DEFAULT_UI_SETTINGS };
    }

    const existing = await apiGetOrNull<MetadataRecord>(METADATA_PATH);
    if (existing) {
      return parseUiSettingsValue(existing.value);
    }

    const created = await createUiSettings(DEFAULT_UI_SETTINGS);
    return parseUiSettingsValue(created.value);
  } catch {
    return { ...DEFAULT_UI_SETTINGS };
  }
}
