// Formats a plan's access-window expiry for display on the account page. The
// backend exposes the window as `accessUntil` (epoch ms) on GET /v1/auth/me; a
// paid or trial account always has one. We show the absolute expiry date, and —
// only when the plan is close to ending — a relative "days left" hint so an
// expiring trial/subscription is obvious at a glance.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Show the "days left" hint only once the window is this close (inclusive).
export const DAYS_REMAINING_THRESHOLD = 30;

export type PlanExpiry = {
  // The absolute expiry, e.g. "July 30, 2026". Locale/timezone dependent, so
  // render it with suppressHydrationWarning (server and client TZ can differ).
  date: string;
  // A short relative hint ("24 days left", "1 day left", "expires today") when
  // the window is within DAYS_REMAINING_THRESHOLD, else null (date is enough).
  daysRemaining: string | null;
};

// Whole days from `nowMs` until `accessUntilMs`, rounded up so any part of a day
// still counts as a day remaining (e.g. 6 hours left → "1 day left").
function daysUntil(accessUntilMs: number, nowMs: number): number {
  return Math.ceil((accessUntilMs - nowMs) / MS_PER_DAY);
}

export function formatPlanExpiry(
  accessUntilMs: number,
  nowMs: number,
): PlanExpiry {
  const date = new Date(accessUntilMs).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const days = daysUntil(accessUntilMs, nowMs);
  let daysRemaining: string | null = null;
  if (days <= DAYS_REMAINING_THRESHOLD) {
    if (days <= 0) {
      daysRemaining = "expires today";
    } else {
      daysRemaining = `${days} day${days === 1 ? "" : "s"} left`;
    }
  }

  return { date, daysRemaining };
}
