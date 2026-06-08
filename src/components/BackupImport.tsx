"use client";

import { useState, type ReactNode } from "react";
import Button from "./Button";
import SettingsSection from "./SettingsSection";
import { useToast } from "./ToastProvider";
import styles from "./BackupImport.module.css";

type BackupAction = {
  id: string;
  title: string;
  description: string;
  buttonLabel: string;
  icon: ReactNode;
};

const ACTIONS: BackupAction[] = [
  {
    id: "backup",
    title: "Backup Data",
    description: "Backup and download your data.",
    buttonLabel: "Backup Data",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {/* Lidded archive box. */}
        <path d="M21 8v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8" />
        <path d="M2 4h20v4H2z" />
        <path d="M10 12h4" />
      </svg>
    ),
  },
  {
    id: "import-file",
    title: "Import Data (From File)",
    description: "Load records from an uploaded data file.",
    buttonLabel: "Import From File",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {/* A document with a down arrow into it. */}
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6" />
        <path d="M12 12v5M9.5 14.5 12 17 14.5 14.5" />
      </svg>
    ),
  },
  {
    id: "import-backup",
    title: "Import Data (From Backup)",
    description: "Import the from the last backup.",
    buttonLabel: "Import From Backup",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {/* Circular restore arrow. */}
        <path d="M2 4v6h6" />
        <path d="M3.5 15a9 9 0 1 0 2.1-9.4L2 10" />
      </svg>
    ),
  },
  {
    id: "seed-sample",
    title: "Seed Sample Data",
    description: "Populate the app with starter data to explore.",
    buttonLabel: "Seed Sample Data",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {/* A sprout / seedling. */}
        <path d="M12 20v-9" />
        <path d="M12 11C9 11 6 9 6 5c4 0 6 2 6 6z" />
        <path d="M12 11c3 0 6-2 6-6-4 0-6 2-6 6z" />
      </svg>
    ),
  },
  {
    id: "seed-seths",
    title: "Seed Seth's Data",
    description: "Load Seth's collection as a large data set.",
    buttonLabel: "Seed Seth's Data",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {/* A person / user. */}
        <circle cx="12" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      </svg>
    ),
  },
];

// Reads the error detail the seed Route Handler forwards from the backend
// (its { status, message } body). Returns null if there's nothing usable.
async function readErrorMessage(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? null;
  } catch {
    return null;
  }
}

export default function BackupImport() {
  // disable buttons until previous requests return
  const [seeding, setSeeding] = useState(false);
  const { showToast, showSnackbar } = useToast();

  const handleSeedSampleData = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed-sample-data", { method: "POST" });
      if (res.ok) {
        showToast({
          message: "Sample data seeded successfully.",
          variant: "success",
        });
      } else {
        const detail = await readErrorMessage(res);
        console.error(`Seed sample data failed: ${res.status}`, detail ?? "");
        // Errors stay up as a snackbar until the user acknowledges them, and we
        // surface the backend's detail when it sends one.
        showSnackbar({
          message: detail
            ? `Couldn't seed sample data: ${detail}`
            : "Couldn't seed sample data. Please try again.",
          variant: "error",
        });
      }
    } catch (error) {
      console.error("Seed sample data request failed", error);
      showSnackbar({
        message: "Couldn't seed sample data. Please try again.",
        variant: "error",
      });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <SettingsSection
      title="Backup & Import"
      description="Save, restore, and seed your collection data."
    >
      {ACTIONS.map((action) => {
        const isSeedSample = action.id === "seed-sample";
        return (
          <div key={action.id} className={styles.row}>
            <span className={styles.icon}>{action.icon}</span>
            <div className={styles.text}>
              <span className={styles.title}>{action.title}</span>
              <span className={styles.description}>{action.description}</span>
            </div>
            <Button
              className={styles.actionButton}
              disabled={seeding}
              onClick={isSeedSample ? handleSeedSampleData : undefined}
            >
              {isSeedSample && seeding ? "Seeding…" : action.buttonLabel}
            </Button>
          </div>
        );
      })}
    </SettingsSection>
  );
}
