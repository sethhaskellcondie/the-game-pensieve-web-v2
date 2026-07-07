import { render, screen } from "@testing-library/react";
import {
  SessionProvider,
  capabilitiesFor,
  useSession,
} from "@/components/auth/SessionProvider";
import type { SessionView } from "@/lib/sessionConfig";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const ACTIVE = { slug: "showcase-one", name: "Showcase One" };

describe("capabilitiesFor with an active showcase", () => {
  it("collapses collection capabilities to the guest row for every role", () => {
    for (const role of ["guest", "trial", "paid", "lapsed", "unknown"] as const) {
      expect(capabilitiesFor(role, ACTIVE)).toEqual({
        canWrite: false,
        canFilter: true,
        canImport: false,
        canBackup: false,
        isAdmin: false,
      });
    }
  });

  it("keeps account-level isAdmin for an admin viewer", () => {
    expect(capabilitiesFor("admin", ACTIVE)).toEqual({
      canWrite: false,
      canFilter: true,
      canImport: false,
      canBackup: false,
      isAdmin: true,
    });
  });

  it("grants FILTER even to roles that lack it at home (backend GUEST scope)", () => {
    // At home a lapsed account can't filter; while viewing a showcase the
    // backend treats every caller as GUEST, which holds FILTER.
    expect(capabilitiesFor("lapsed").canFilter).toBe(false);
    expect(capabilitiesFor("lapsed", ACTIVE).canFilter).toBe(true);
  });

  it("is unchanged when no showcase is active", () => {
    expect(capabilitiesFor("paid")).toEqual({
      canWrite: true,
      canFilter: true,
      canImport: true,
      canBackup: true,
      isAdmin: false,
    });
  });
});

function Probe() {
  const s = useSession();
  return (
    <div>
      <span data-testid="canWrite">{String(s.canWrite)}</span>
      <span data-testid="canFilter">{String(s.canFilter)}</span>
      <span data-testid="canImport">{String(s.canImport)}</span>
      <span data-testid="canBackup">{String(s.canBackup)}</span>
      <span data-testid="isAdmin">{String(s.isAdmin)}</span>
      <span data-testid="showcase">{s.activeShowcase?.name ?? "none"}</span>
    </div>
  );
}

describe("SessionProvider with an active showcase", () => {
  it("seeds the collapsed capabilities and exposes the showcase", () => {
    const view: SessionView = {
      role: "paid",
      email: "collector@example.com",
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase: ACTIVE,
    };
    render(
      <SessionProvider initial={view}>
        <Probe />
      </SessionProvider>,
    );
    expect(screen.getByTestId("canWrite")).toHaveTextContent("false");
    expect(screen.getByTestId("canFilter")).toHaveTextContent("true");
    expect(screen.getByTestId("canImport")).toHaveTextContent("false");
    expect(screen.getByTestId("canBackup")).toHaveTextContent("false");
    expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
    expect(screen.getByTestId("showcase")).toHaveTextContent("Showcase One");
  });
});
