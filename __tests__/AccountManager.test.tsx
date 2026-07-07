import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import AccountManager from "@/components/account/AccountManager";
import { SessionProvider } from "@/components/auth/SessionProvider";
import type { SessionView } from "@/lib/sessionConfig";

// SessionProvider wires a 401 handler to the router; a stub is enough.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

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
      <AccountManager />
    </SessionProvider>,
  );
}

describe("AccountManager", () => {
  it("shows the signed-in email and the current plan", () => {
    renderWith({ role: "paid", email: "collector@example.com" });
    expect(screen.getByText("collector@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Plan: Paid")).toHaveTextContent("Paid");
  });

  it("renders an unresolved role plainly as Unknown", () => {
    renderWith({ role: "unknown", email: "collector@example.com" });
    expect(screen.getByLabelText("Plan: Unknown")).toHaveTextContent("Unknown");
  });

  it("falls back to a dash when no email is present", () => {
    renderWith({ role: "lapsed", email: null });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows the Admin Dashboard link for admins, pointing at /admin", () => {
    renderWith({ role: "admin", email: "boss@example.com" });
    const link = screen.getByRole("link", { name: "Admin Dashboard" });
    expect(link).toHaveAttribute("href", "/admin");
  });

  it("hides the Admin Dashboard link for non-admins", () => {
    renderWith({ role: "paid", email: "collector@example.com" });
    expect(
      screen.queryByRole("link", { name: "Admin Dashboard" }),
    ).not.toBeInTheDocument();
  });

  const DAY = 24 * 60 * 60 * 1000;

  it("shows how long a paid plan stays active, without a hint when far off", () => {
    renderWith({
      role: "paid",
      email: "collector@example.com",
      accessUntil: Date.now() + 400 * DAY,
    });
    expect(screen.getByText("Active until")).toBeInTheDocument();
    // More than 30 days out: the date alone, no "days left" hint.
    expect(screen.queryByText(/left/)).not.toBeInTheDocument();
  });

  it("adds a days-left hint for a trial ending within 30 days", () => {
    renderWith({
      role: "trial",
      email: "collector@example.com",
      accessUntil: Date.now() + 10 * DAY,
    });
    expect(screen.getByText("Active until")).toBeInTheDocument();
    expect(screen.getByText(/days left/)).toBeInTheDocument();
  });

  it("hides the active-until row for a lapsed account", () => {
    renderWith({
      role: "lapsed",
      email: "collector@example.com",
      accessUntil: Date.now() - 5 * DAY,
    });
    expect(screen.queryByText("Active until")).not.toBeInTheDocument();
  });

  it("hides the active-until row for an admin (no window)", () => {
    renderWith({ role: "admin", email: "boss@example.com", accessUntil: null });
    expect(screen.queryByText("Active until")).not.toBeInTheDocument();
  });
});
