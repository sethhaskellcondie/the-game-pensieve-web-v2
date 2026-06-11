"use client";

import type { ReactNode } from "react";
import SettingsSection from "./SettingsSection";
import Toggle from "./Toggle";
import { useUiSettings } from "./UiSettingsProvider";
import type { UiSettings, VideoGamesView } from "@/lib/uiSettings.types";
import styles from "./UiSettings.module.css";

// Only the boolean settings render as switches; videoGamesDefaultView gets its
// own segmented control below.
type SettingKey = {
  [K in keyof UiSettings]: UiSettings[K] extends boolean ? K : never;
}[keyof UiSettings];

type SettingMeta = {
  key: SettingKey;
  title: string;
  description: string;
  icon: ReactNode;
};

const VIDEO_GAMES_VIEWS: { value: VideoGamesView; label: string }[] = [
  { value: "list", label: "List" },
  { value: "shelf", label: "Shelf" },
];

const SETTINGS: SettingMeta[] = [
  {
    key: "massInputMode",
    title: "Mass Input Mode",
    description: "Add many entries in a row without leaving the form.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {/* Two arrows dropping down into an inbox tray. */}
        <path d="M9 2v8M6.5 7.5 9 10 11.5 7.5M15 2v8M12.5 7.5 15 10 17.5 7.5" />
        <path d="M3 13v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6h-5l-1.5 2.5h-5L8 13z" />
      </svg>
    ),
  },
  {
    key: "massEditMode",
    title: "Mass Edit Mode",
    description: "Select and update multiple records at once.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {/* A sheet of paper with a folded corner, and a pen writing on it. */}
        <path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6Z" />
        <path d="M14 3v3h3" />
        <path d="M15.5 8.5a1.8 1.8 0 0 1 2.5 2.5L10.5 18.5l-3.5 1 1-3.5Z" />
        <path d="M13.5 10.5l2.5 2.5" />
      </svg>
    ),
  },
  {
    key: "developerMode",
    title: "Developer Mode",
    description: "Show the developer tools.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" />
      </svg>
    ),
  },
  {
    key: "hideAnimations",
    title: "Hide Animations",
    description: "Show a static header instead of the animated background.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 9v6M14 9v6M4 4l16 16M4 12a8 8 0 0 1 8-8M20 12a8 8 0 0 1-8 8" />
      </svg>
    ),
  },
];

export default function UiSettings() {
  const { settings, setSetting, saving } = useUiSettings();

  const toggle = (key: SettingKey) => (next: boolean) => {
    void setSetting(key, next);
  };

  return (
    <SettingsSection
      title="UI Settings"
      description="Interface preferences applied across the Pensieve."
    >
      {SETTINGS.map((setting) => (
        <div key={setting.key} className={styles.row}>
          <span className={styles.icon}>{setting.icon}</span>
          <div className={styles.text}>
            <span className={styles.title}>{setting.title}</span>
            <span className={styles.description}>{setting.description}</span>
          </div>
          <Toggle
            label={setting.title}
            checked={settings[setting.key]}
            onChange={toggle(setting.key)}
            disabled={saving}
          />
        </div>
      ))}
      <div className={styles.row}>
        <span className={styles.icon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {/* A shelf with three boxes standing on it. */}
            <path d="M3 19h18" />
            <rect x="4" y="8" width="4" height="11" rx="1" />
            <rect x="10" y="5" width="4" height="14" rx="1" />
            <rect x="16" y="10" width="4" height="9" rx="1" />
          </svg>
        </span>
        <div className={styles.text}>
          <span className={styles.title}>Default Video Games View</span>
          <span className={styles.description}>
            Which view the Video Games page opens with.
          </span>
        </div>
        <div
          className={styles.segments}
          role="radiogroup"
          aria-label="Default Video Games View"
        >
          {VIDEO_GAMES_VIEWS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={settings.videoGamesDefaultView === option.value}
              className={styles.segment}
              disabled={saving}
              onClick={() => void setSetting("videoGamesDefaultView", option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}
