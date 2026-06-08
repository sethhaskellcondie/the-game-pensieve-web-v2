"use client";

import { useState, type ReactNode } from "react";
import Button from "./Button";
import SettingsSection from "./SettingsSection";
import { useToast } from "./ToastProvider";
import { backupFilename, downloadTextFile } from "@/lib/download";
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

// Uppercases the first character for use at the start of a sentence.
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Maps a seed action id to its Route Handler and the noun used in messages.
const SEED_ENDPOINTS: Record<string, { endpoint: string; label: string }> = {
  "seed-sample": { endpoint: "/api/seed-sample-data", label: "sample data" },
  "seed-seths": { endpoint: "/api/seed-my-collection", label: "Seth's data" },
};

export default function BackupImport() {
  // Tracks which action is in flight (null when idle) so we can disable the
  // buttons and show progress on the one that's running.
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast, showSnackbar } = useToast();

  const handleBackup = async () => {
    setBusyId("backup");
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (res.ok) {
        const body = (await res.json()) as { data?: unknown };
        downloadTextFile(
          backupFilename(),
          JSON.stringify(body.data, null, 2),
        );
        showToast({ message: "Backup downloaded.", variant: "success" });
      } else {
        const detail = await readErrorMessage(res);
        console.error(`Backup failed: ${res.status}`, detail ?? "");
        showSnackbar({
          message: detail
            ? `Couldn't back up data: ${detail}`
            : "Couldn't back up data. Please try again.",
          variant: "error",
        });
      }
    } catch (error) {
      console.error("Backup request failed", error);
      showSnackbar({
        message: "Couldn't back up data. Please try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSeed = async (id: string) => {
    const seed = SEED_ENDPOINTS[id];
    if (!seed) return;
    setBusyId(id);
    try {
      const res = await fetch(seed.endpoint, { method: "POST" });
      if (res.ok) {
        showToast({
          message: `${capitalize(seed.label)} seeded successfully.`,
          variant: "success",
        });
      } else {
        const detail = await readErrorMessage(res);
        console.error(`Seed ${seed.label} failed: ${res.status}`, detail ?? "");
        // Errors stay up as a snackbar until the user acknowledges them, and we
        // surface the backend's detail when it sends one.
        showSnackbar({
          message: detail
            ? `Couldn't seed ${seed.label}: ${detail}`
            : `Couldn't seed ${seed.label}. Please try again.`,
          variant: "error",
        });
      }
    } catch (error) {
      console.error(`Seed ${seed.label} request failed`, error);
      showSnackbar({
        message: `Couldn't seed ${seed.label}. Please try again.`,
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SettingsSection
      title="Backup & Import"
      description="Save, restore, and seed your collection data."
    >
      {ACTIONS.map((action) => {
        const isBackup = action.id === "backup";
        const isSeedAction = action.id in SEED_ENDPOINTS;
        const onClick = isBackup
          ? handleBackup
          : isSeedAction
            ? () => handleSeed(action.id)
            : undefined;
        const busyLabel = isBackup ? "Backing up…" : "Seeding…";
        return (
          <div key={action.id} className={styles.row}>
            <span className={styles.icon}>{action.icon}</span>
            <div className={styles.text}>
              <span className={styles.title}>{action.title}</span>
              <span className={styles.description}>{action.description}</span>
            </div>
            <Button
              className={styles.actionButton}
              disabled={busyId !== null}
              onClick={onClick}
            >
              {busyId === action.id ? busyLabel : action.buttonLabel}
            </Button>
          </div>
        );
      })}
    </SettingsSection>
  );
}
