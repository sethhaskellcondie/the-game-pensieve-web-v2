import {
  DAYS_REMAINING_THRESHOLD,
  formatPlanExpiry,
} from "@/lib/planExpiry";

const DAY = 24 * 60 * 60 * 1000;
// A fixed "now" keeps the day math deterministic and timezone-independent.
const NOW = 1_700_000_000_000;

describe("formatPlanExpiry", () => {
  it("always returns a non-empty absolute date", () => {
    const { date } = formatPlanExpiry(NOW + 45 * DAY, NOW);
    expect(typeof date).toBe("string");
    expect(date.length).toBeGreaterThan(0);
  });

  it("omits the days-left hint when the window is beyond the threshold", () => {
    expect(formatPlanExpiry(NOW + 45 * DAY, NOW).daysRemaining).toBeNull();
    // One day past the threshold is still omitted.
    expect(
      formatPlanExpiry(NOW + (DAYS_REMAINING_THRESHOLD + 1) * DAY, NOW)
        .daysRemaining,
    ).toBeNull();
  });

  it("shows the days-left hint at exactly the threshold", () => {
    expect(
      formatPlanExpiry(NOW + DAYS_REMAINING_THRESHOLD * DAY, NOW).daysRemaining,
    ).toBe(`${DAYS_REMAINING_THRESHOLD} days left`);
  });

  it("counts down within the threshold", () => {
    expect(formatPlanExpiry(NOW + 10 * DAY, NOW).daysRemaining).toBe("10 days left");
  });

  it("uses the singular for a single day", () => {
    expect(formatPlanExpiry(NOW + 1 * DAY, NOW).daysRemaining).toBe("1 day left");
  });

  it("rounds a partial day up to a full day remaining", () => {
    // 6 hours left still reads as one day.
    expect(formatPlanExpiry(NOW + DAY / 4, NOW).daysRemaining).toBe("1 day left");
  });

  it("reports 'expires today' when the window has reached now or passed", () => {
    expect(formatPlanExpiry(NOW, NOW).daysRemaining).toBe("expires today");
    expect(formatPlanExpiry(NOW - 2 * DAY, NOW).daysRemaining).toBe("expires today");
  });
});
