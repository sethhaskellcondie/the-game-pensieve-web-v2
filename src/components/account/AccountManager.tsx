"use client";

import { useRef, useSyncExternalStore } from "react";
import BeginnerHint from "../BeginnerHint";
import Button from "../Button";
import SettingsSection from "../SettingsSection";
import PlanBadge from "../auth/PlanBadge";
import ShowcaseSwitcher from "../auth/ShowcaseSwitcher";
import { useSession } from "../auth/SessionProvider";
import { formatPlanExpiry } from "@/lib/planExpiry";
import styles from "./AccountManager.module.css";

// The plan-expiry "now" never changes while mounted, so useSyncExternalStore
// needs only a no-op subscription.
const noopSubscribe = () => () => {};

// The Account page body. Today it surfaces the read-only Profile section (email
// + plan) sourced from the live client session, so it reflects runtime role
// changes (e.g. a mid-session lapse) without a reload. This is intentionally a
// thin, section-based shell: payment, password reset, and other features land as
// additional <SettingsSection> blocks below without disturbing this one.
export default function AccountManager() {
  const { email, role, isAdmin, accessUntil } = useSession();

  // A client-only "now", captured once. Read via useSyncExternalStore so the
  // impure Date.now() call happens the React-sanctioned way (not during render,
  // not via setState-in-effect). The server snapshot is null, so the row is
  // absent during SSR and the initial hydration render — avoiding a timezone/
  // clock mismatch on the locale-formatted date and countdown — then it appears
  // on the client.
  const nowRef = useRef<number | null>(null);
  const now = useSyncExternalStore(
    noopSubscribe,
    () => (nowRef.current ??= Date.now()),
    () => null,
  );

  // The active window applies to the time-boxed plans (paid + trial). Admins are
  // pinned (no window), and lapsed/guest have nothing active to show. When the
  // window is 30 days or less out we also show a "days left" hint.
  const expiry =
    now != null && (role === "paid" || role === "trial") && accessUntil != null
      ? formatPlanExpiry(accessUntil, now)
      : null;

  return (
    <>
      <SettingsSection
        title="Profile"
        description="Your account identity and current plan."
      >
        <div className={styles.row}>
          <span className={styles.label}>Email</span>
          <span className={styles.value}>{email ?? "—"}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Plan</span>
          <PlanBadge role={role} onLight />
        </div>
        {expiry ? (
          <div className={styles.row}>
            <span className={styles.label}>Active until</span>
            <span className={styles.value}>
              {expiry.date}
              {expiry.daysRemaining ? ` (${expiry.daysRemaining})` : ""}
            </span>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Showcase"
        description="Choose which public showcase to view."
      >
        <div className={styles.row}>
          <ShowcaseSwitcher />
          <BeginnerHint
            placement="bottom-end"
            text="While logged in you can still browse the other showcase collections that are available."
          />
        </div>
      </SettingsSection>

      {/* The Admin Dashboard is reachable ONLY from here (it was removed from the
          sidebar) and only for admins. The /admin route re-checks the role
          server-side, so this button is a convenience entry point, not the gate. */}
      {isAdmin ? (
        <SettingsSection
          title="Administration"
          description="Manage user roles and access."
        >
          <div className={styles.row}>
            <span className={styles.label}>Admin tools</span>
            <Button href="/admin">Admin Dashboard</Button>
          </div>
        </SettingsSection>
      ) : null}

      {/* Future sections (payment information, password reset, …) go here as
          additional <SettingsSection> blocks. */}
    </>
  );
}
