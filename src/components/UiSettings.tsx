"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import SettingsSection from "./SettingsSection";
import Toggle from "./Toggle";
import { useDeveloperMode } from "./DeveloperModeContext";
import styles from "./UiSettings.module.css";

type SettingKey = "massInput" | "massEdit" | "developer";

type SettingMeta = {
  key: SettingKey;
  title: string;
  description: string;
  icon: ReactNode;
};

const SETTINGS: SettingMeta[] = [
  {
    key: "massInput",
    title: "Mass Input Mode",
    description: "Add many entries in a row without leaving the form.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
  {
    key: "massEdit",
    title: "Mass Edit Mode",
    description: "Select and update multiple records at once.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 4l6 6M3 21l3-1 11-11-2-2L4 18l-1 3z" />
      </svg>
    ),
  },
  {
    key: "developer",
    title: "Developer Mode",
    description: "Show the developer tools.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" />
      </svg>
    ),
  },
];

export default function UiSettings() {
  const { setDeveloperMode } = useDeveloperMode();
  const [values, setValues] = useState<Record<SettingKey, boolean>>({
    massInput: false,
    massEdit: false,
    developer: false,
  });

  const toggle = (key: SettingKey) => (next: boolean) => {
    setValues((prev) => ({ ...prev, [key]: next }));
    if (key === "developer") setDeveloperMode(next);
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
            checked={values[setting.key]}
            onChange={toggle(setting.key)}
          />
        </div>
      ))}
    </SettingsSection>
  );
}
