"use client";

import type { ReactNode } from "react";
import Button from "./Button";
import SettingsSection from "./SettingsSection";
import Toggle from "./Toggle";
import { BoardGamesIcon, VideoGamesIcon } from "./icons";
import { useUiSettings } from "./UiSettingsProvider";
import type { CollectionView, UiSettings } from "@/lib/uiSettings.types";
import styles from "./UiSettings.module.css";

// Only the boolean settings render as switches; the default-view settings get
// their own segmented controls below.
type SettingKey = {
  [K in keyof UiSettings]: UiSettings[K] extends boolean ? K : never;
}[keyof UiSettings];

type ViewSettingKey = {
  [K in keyof UiSettings]: UiSettings[K] extends CollectionView ? K : never;
}[keyof UiSettings];

type SettingMeta = {
  key: SettingKey;
  title: string;
  description: string;
  icon: ReactNode;
};

const VIEW_OPTIONS: { value: CollectionView; label: string }[] = [
  { value: "list", label: "List" },
  { value: "shelf", label: "Shelf" },
];

// One List/Shelf default-view choice per game collection. Board games is
// stored ahead of its page being built, so the preference is already in place
// when that screen lands.
const VIEW_SETTINGS: {
  key: ViewSettingKey;
  title: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    key: "videoGamesDefaultView",
    title: "Default Video Games View",
    description: "Which view the Video Games page opens with.",
    icon: <VideoGamesIcon />,
  },
  {
    key: "boardGamesDefaultView",
    title: "Default Board Games View",
    description: "Which view the Board Games page opens with.",
    icon: <BoardGamesIcon />,
  },
];

const SETTINGS: SettingMeta[] = [
  {
    key: "beginnerMode",
    title: "Beginner Mode",
    description: "Show extra guidance while you learn how to use the Pensieve.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {/* A young seedling: stem with two leaves. */}
        <path d="M12 21v-8" />
        <path d="M12 13C12 9 9.5 6.5 4 6c.5 5.5 3 8 8 7Z" />
        <path d="M12 11c0-3.5 2-5.5 8-6-.5 5-2.5 7-8 6Z" />
      </svg>
    ),
  },
  {
    key: "massInputMode",
    title: "Mass Input Mode",
    description: "Input forms will loop, speeding up data entry.",
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
    description: "Allows in-line editing of records in the display chart.",
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
    description: "Includes extra buttons for debugging and testing.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" />
      </svg>
    ),
  },
  {
    key: "hideAnimations",
    title: "Hide Animations",
    description: "Show a static header instead of the animating the background.",
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
      {VIEW_SETTINGS.map((setting) => (
        <div key={setting.key} className={styles.row}>
          <span className={styles.icon}>{setting.icon}</span>
          <div className={styles.text}>
            <span className={styles.title}>{setting.title}</span>
            <span className={styles.description}>{setting.description}</span>
          </div>
          <div
            className={styles.segments}
            role="radiogroup"
            aria-label={setting.title}
          >
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={settings[setting.key] === option.value}
                className={styles.segment}
                disabled={saving}
                onClick={() => void setSetting(setting.key, option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className={styles.row}>
        <span className={styles.icon}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {/* A display grid with a column highlighted. */}
            <path d="M3 4h18v16H3z" />
            <path d="M3 9h18M9 4v16M15 4v16" />
          </svg>
        </span>
        <div className={styles.text}>
          <span className={styles.title}>Show/Hide Standard Fields</span>
          <span className={styles.description}>
            Choose which standard fields appear in the display grid.
          </span>
        </div>
        <Button className={styles.actionButton} disabled={saving}>
          Set Fields
        </Button>
      </div>
    </SettingsSection>
  );
}
