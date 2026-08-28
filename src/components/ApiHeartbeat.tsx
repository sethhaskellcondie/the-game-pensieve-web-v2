"use client";

import { useState } from "react";
import Button from "./Button";
import SettingsSection from "./SettingsSection";
import { useUiSettings } from "./UiSettingsProvider";
import styles from "./ApiHeartbeat.module.css";

type Status = "idle" | "online" | "offline";

// Pings the backend health check via our /api/heartbeat Route Handler (which
// proxies the real backend server-side). A healthy ping shows a green dot
// beside a stacked readout of the backend's security posture (SECURED when the
// `secured` profile enforces auth, UNSECURED for the permit-all build — omitted
// when the backend didn't report it) and its release version (also omitted when
// unreported, e.g. a backend older than the version field); a failed ping shows
// OFFLINE.
export default function ApiHeartbeat() {
  const { settings } = useUiSettings();
  const [status, setStatus] = useState<Status>("idle");
  const [secureMode, setSecureMode] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runHeartbeat = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        settings.developerMode ? "/api/heartbeat?debug=1" : "/api/heartbeat",
      );
      const body = (await res.json()) as {
        status?: string;
        secureMode?: boolean | null;
        version?: string | null;
      };
      const online = res.ok && body.status === "online";
      setStatus(online ? "online" : "offline");
      setSecureMode(
        online && typeof body.secureMode === "boolean"
          ? body.secureMode
          : null,
      );
      setVersion(
        online && typeof body.version === "string" && body.version
          ? body.version
          : null,
      );
    } catch {
      setStatus("offline");
      setSecureMode(null);
      setVersion(null);
    } finally {
      setLoading(false);
    }
  };

  // The API Tools section is a developer-only utility; hide it entirely
  // unless developer mode is enabled.
  if (!settings.developerMode) {
    return null;
  }

  return (
    <SettingsSection
      title="API Tools"
      description=""
    >
      <div className={styles.row}>
        <span className={styles.icon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h4l2 6 4-12 2 6h6" />
          </svg>
        </span>
        <div className={styles.text}>
          <span className={styles.title}>API Heartbeat Check</span>
          <span className={styles.description}>
            Ping the data service and confirm it&apos;s responding.
          </span>
        </div>

        <output className={styles.status} aria-live="polite">
          {status === "online" && (
            <span className={`${styles.statusPill} ${styles.online}`}>
              <span className={styles.dot} />
              <span className={styles.statusLines}>
                {secureMode !== null && (
                  <span>{secureMode ? "SECURED" : "UNSECURED"}</span>
                )}
                {version !== null && <span>{`v${version}`}</span>}
              </span>
            </span>
          )}
          {status === "offline" && (
            <span className={`${styles.statusPill} ${styles.offline}`}>
              <span className={styles.dot} />
              OFFLINE
            </span>
          )}
        </output>

        <Button
          className={styles.checkButton}
          onClick={runHeartbeat}
          disabled={loading}
        >
          {"Check Heartbeat"}
        </Button>
      </div>
    </SettingsSection>
  );
}
