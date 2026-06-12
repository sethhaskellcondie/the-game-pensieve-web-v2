"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Button from "./Button";
import SettingsSection from "./SettingsSection";
import { useToast } from "./ToastProvider";
import { useUiSettings } from "./UiSettingsProvider";
import { backupFilename, downloadTextFile } from "@/lib/download";
import styles from "./BackupImport.module.css";

type BackupAction = {
  id: string;
  title: string;
  description: string;
  buttonLabel: string;
  icon: ReactNode;
  developerOnly?: boolean;
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
    developerOnly: true,
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
    developerOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {/* A person / user. */}
        <circle cx="12" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      </svg>
    ),
  },
];

// Reads the error detail a Route Handler forwards from the backend (its
// { status, message } body). Returns null if there's nothing usable.
async function readErrorMessage(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? null;
  } catch {
    return null;
  }
}

// A fire-and-forget POST action: hit a Route Handler, then toast on success or
// snackbar on failure. Backup is handled separately since it downloads a file.
type PostAction = {
  endpoint: string;
  busyLabel: string; // shown on the button while the request is in flight
  successMessage: string;
  failureMessage: string; // generic snackbar when no backend detail is available
  detailMessage: (detail: string) => string; // snackbar when the backend explains why
  logLabel: string; // prefix for console.error
};

const POST_ACTIONS: Record<string, PostAction> = {
  "seed-sample": {
    endpoint: "/api/seed-sample-data",
    busyLabel: "Seeding…",
    successMessage: "Sample data seeded successfully.",
    failureMessage: "Couldn't seed sample data. Please try again.",
    detailMessage: (detail) => `Couldn't seed sample data: ${detail}`,
    logLabel: "Seed sample data",
  },
  "seed-seths": {
    endpoint: "/api/seed-my-collection",
    busyLabel: "Seeding…",
    successMessage: "Seth's data seeded successfully.",
    failureMessage: "Couldn't seed Seth's data. Please try again.",
    detailMessage: (detail) => `Couldn't seed Seth's data: ${detail}`,
    logLabel: "Seed Seth's data",
  },
  "import-backup": {
    endpoint: "/api/import-from-backup",
    busyLabel: "Importing…",
    successMessage: "Data imported from backup successfully.",
    failureMessage: "Couldn't import from backup. Please try again.",
    detailMessage: (detail) => `Couldn't import from backup: ${detail}`,
    logLabel: "Import from backup",
  },
};

export default function BackupImport() {
  // Tracks which action is in flight (null when idle) so we can disable the
  // buttons and show progress on the one that's running.
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast, showSnackbar } = useToast();
  const { settings } = useUiSettings();

  // Developer-only actions (restore-from-backup, Seth's seed data) stay hidden
  // unless developer mode is enabled.
  const visibleActions = ACTIONS.filter(
    (action) => !action.developerOnly || settings.developerMode,
  );

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

  // Opening the OS file picker is the button's job; the actual work happens in
  // handleFileSelected once the user has chosen a file.
  const handleImportFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so picking the same file again still fires `change`.
    event.target.value = "";
    if (!file) return;

    setBusyId("import-file");
    try {
      const text = await file.text();

      // Validate the file is JSON before bothering the server, so a bad file
      // gets a clear message instead of an opaque backend error.
      try {
        JSON.parse(text);
      } catch {
        showSnackbar({
          message: "That file isn't valid JSON. Please choose a backup file.",
          variant: "error",
        });
        return;
      }

      // The file holds the backup `data` payload verbatim; send it as-is and
      // let the Route Handler wrap it the way the /import endpoint expects.
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      if (res.ok) {
        showToast({
          message: "Data imported from file successfully.",
          variant: "success",
        });
      } else {
        const detail = await readErrorMessage(res);
        console.error(`Import from file failed: ${res.status}`, detail ?? "");
        showSnackbar({
          message: detail
            ? `Couldn't import from file: ${detail}`
            : "Couldn't import from file. Please try again.",
          variant: "error",
        });
      }
    } catch (error) {
      console.error("Import from file request failed", error);
      showSnackbar({
        message: "Couldn't import from file. Please try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handlePostAction = async (id: string) => {
    const config = POST_ACTIONS[id];
    if (!config) return;
    setBusyId(id);
    try {
      const res = await fetch(config.endpoint, { method: "POST" });
      if (res.ok) {
        showToast({ message: config.successMessage, variant: "success" });
      } else {
        const detail = await readErrorMessage(res);
        console.error(`${config.logLabel} failed: ${res.status}`, detail ?? "");
        // Errors stay up as a snackbar until the user acknowledges them, and we
        // surface the backend's detail when it sends one.
        showSnackbar({
          message: detail ? config.detailMessage(detail) : config.failureMessage,
          variant: "error",
        });
      }
    } catch (error) {
      console.error(`${config.logLabel} request failed`, error);
      showSnackbar({ message: config.failureMessage, variant: "error" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SettingsSection
      title="Backup & Import"
      description=""
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.json,application/json"
        onChange={handleFileSelected}
        hidden
      />
      {visibleActions.map((action) => {
        const isBackup = action.id === "backup";
        const isImportFile = action.id === "import-file";
        const postAction = POST_ACTIONS[action.id];
        const onClick = isBackup
          ? handleBackup
          : isImportFile
            ? handleImportFileClick
            : postAction
              ? () => handlePostAction(action.id)
              : undefined;
        const busyLabel = isBackup
          ? "Backing up…"
          : isImportFile
            ? "Importing…"
            : postAction?.busyLabel;
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
