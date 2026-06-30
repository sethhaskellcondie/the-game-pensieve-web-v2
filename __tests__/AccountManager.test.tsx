import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import AccountManager from "@/components/account/AccountManager";
import { SessionProvider } from "@/components/auth/SessionProvider";
import type { SessionView } from "@/lib/sessionConfig";

// SessionProvider wires a 401 handler to the router; a stub is enough.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

function renderWith(initial: SessionView) {
  render(
    <SessionProvider initial={initial}>
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
});
