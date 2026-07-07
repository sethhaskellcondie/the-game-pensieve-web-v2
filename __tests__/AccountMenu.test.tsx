import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import AccountMenu from "@/components/auth/AccountMenu";
import { SessionProvider } from "@/components/auth/SessionProvider";
import {
  FILTERS_STORAGE_PREFIX,
  SORTS_STORAGE_PREFIX,
} from "@/components/filters/persistedViews";
import type { SessionView } from "@/lib/sessionConfig";

// SessionProvider wires a 401 handler to the router; a stub is enough.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

// logout ends with a full-page redirect: window.location.assign("/"). jsdom's
// Location is locked (non-configurable, assign non-writable), so we can't spy
// on it here — its assign is a logged no-op that doesn't throw, so we let it
// run and assert on logout's observable effects (the endpoint call and the
// cleared views) instead. The redirect itself is covered by e2e/auth.spec.ts,
// which asserts the URL returns to home.
beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true } as Response),
  ) as jest.Mock;
});

function renderWith(
  initial: Pick<SessionView, "role" | "email"> & Partial<SessionView>,
) {
  const view: SessionView = {
    isImpersonating: false,
    impersonatedEmail: null,
    accessUntil: null,
    activeShowcase: null,
    ...initial,
  };
  render(
    <SessionProvider initial={view}>
      <AccountMenu />
    </SessionProvider>,
  );
}

describe("AccountMenu logout", () => {
  it("shows a Log out control to an authenticated user but not a guest", () => {
    renderWith({ role: "paid", email: "collector@example.com" });
    expect(
      screen.getByRole("button", { name: "Log out" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Log in" }),
    ).not.toBeInTheDocument();
  });

  it("posts to the logout endpoint when Log out is clicked", async () => {
    renderWith({ role: "paid", email: "collector@example.com" });
    screen.getByRole("button", { name: "Log out" }).click();

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", {
        method: "POST",
      }),
    );
  });

  it("clears the session's persisted filters and sorts on logout", async () => {
    // The logged-in session's applied views, plus an unrelated key that must
    // survive (it isn't a per-collection filter/sort).
    localStorage.setItem(`${FILTERS_STORAGE_PREFIX}toy`, "[]");
    localStorage.setItem(`${SORTS_STORAGE_PREFIX}video-game`, "[]");
    localStorage.setItem("colWidths:toy", "keep-me");

    renderWith({ role: "paid", email: "collector@example.com" });
    screen.getByRole("button", { name: "Log out" }).click();

    // The default showcase has its own fields, so the previous collection's
    // filters/sorts are dropped — but non-view state is left intact.
    await waitFor(() =>
      expect(localStorage.getItem(`${FILTERS_STORAGE_PREFIX}toy`)).toBeNull(),
    );
    expect(
      localStorage.getItem(`${SORTS_STORAGE_PREFIX}video-game`),
    ).toBeNull();
    expect(localStorage.getItem("colWidths:toy")).toBe("keep-me");
  });

  it("still clears views even if the logout request fails", async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error("network down")),
    ) as jest.Mock;
    localStorage.setItem(`${FILTERS_STORAGE_PREFIX}toy`, "[]");

    renderWith({ role: "paid", email: "collector@example.com" });
    screen.getByRole("button", { name: "Log out" }).click();

    await waitFor(() =>
      expect(localStorage.getItem(`${FILTERS_STORAGE_PREFIX}toy`)).toBeNull(),
    );
  });
});
