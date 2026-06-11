"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_UI_SETTINGS,
  type UiSettings,
} from "@/lib/uiSettings.types";

type UiSettingsContextValue = {
  settings: UiSettings;
  // Resolves to true once the change is confirmed by the backend, false if the
  // write was rejected/failed (in which case the in-memory settings are left
  // untouched). Awaitable so callers can react to the outcome.
  setSetting: <K extends keyof UiSettings>(
    key: K,
    next: UiSettings[K],
  ) => Promise<boolean>;
  // True while a write is in flight, so the UI can disable controls and avoid
  // overlapping writes.
  saving: boolean;
};

// Safe defaults make the hook usable without a provider (e.g., a component
// rendered in isolation in a unit test): reads as all-off, writes are no-ops.
const UiSettingsContext = createContext<UiSettingsContextValue>({
  settings: DEFAULT_UI_SETTINGS,
  setSetting: async () => false,
  saving: false,
});

// App-wide store for the UI settings. Seeded with the values the server loaded
// (or created) from the backend, so they are present on the first paint.
//
// Writes are *confirmed*: the new value is sent to the /api/ui-settings Route
// Handler (which proxies the backend PATCH server-side) and only committed to
//  the local state once the backend acknowledges success. A failed write leaves the
// UI showing the last known-good value rather than diverging from the backend.
export function UiSettingsProvider({
  initial,
  children,
}: {
  initial: UiSettings;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<UiSettings>(initial);
  const [saving, setSaving] = useState(false);

  const setSetting = async <K extends keyof UiSettings>(
    key: K,
    next: UiSettings[K],
  ): Promise<boolean> => {
    const updated = { ...settings, [key]: next };
    setSaving(true);
    try {
      const res = await fetch("/api/ui-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) return false;
      setSettings(updated);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <UiSettingsContext.Provider value={{ settings, setSetting, saving }}>
      {children}
    </UiSettingsContext.Provider>
  );
}

export function useUiSettings(): UiSettingsContextValue {
  return useContext(UiSettingsContext);
}
