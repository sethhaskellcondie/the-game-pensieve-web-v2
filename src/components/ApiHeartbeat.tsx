"use client";

import { useState } from "react";
import SettingsSection from "./SettingsSection";
import { useUiSettings } from "./UiSettingsProvider";
import styles from "./ApiHeartbeat.module.css";

type Status = "idle" | "online" | "offline";

// Pings the backend health check via our /api/heartbeat Route Handler (which
// proxies the real backend server-side) and reports ONLINE/OFFLINE plus the
// measured round-trip time.
export default function ApiHeartbeat() {
  const { settings } = useUiSettings();
  const [status, setStatus] = useState<Status>("idle");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const runHeartbeat = async () => {
    setLoading(true);
    const startedAt = performance.now();
    try {
      const res = await fetch(
        settings.developerMode ? "/api/heartbeat?debug=1" : "/api/heartbeat",
      );
      const elapsed = Math.round(performance.now() - startedAt);
      const body = (await res.json()) as { status?: string };
      const online = res.ok && body.status === "online";
      setStatus(online ? "online" : "offline");
      setLatencyMs(online ? elapsed : null);
    } catch {
      setStatus("offline");
      setLatencyMs(null);
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
      description="Check the connection to external data services."
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
          {status !== "idle" && (
            <span
              className={`${styles.statusPill} ${
                status === "online" ? styles.online : styles.offline
              }`}
            >
              <span className={styles.dot} />
              {status === "online"
                ? `ONLINE · ${latencyMs}ms`
                : "OFFLINE"}
            </span>
          )}
        </output>

        <button
          type="button"
          className={styles.button}
          onClick={runHeartbeat}
          disabled={loading}
        >
          {loading ? "Checking…" : "Check Heartbeat"}
        </button>
      </div>
    </SettingsSection>
  );
}
