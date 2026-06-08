"use client";

import type { ReactNode } from "react";
import SettingsSection from "./SettingsSection";
import Toggle from "./Toggle";
import { useUiSettings } from "./UiSettingsProvider";
import type { UiSettings } from "@/lib/uiSettings.types";
import styles from "./UiSettings.module.css";

type SettingKey = keyof UiSettings;

type SettingMeta = {
  key: SettingKey;
  title: string;
  description: string;
  icon: ReactNode;
};

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
    </SettingsSection>
  );
}
