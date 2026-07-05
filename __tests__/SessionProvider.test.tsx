import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import {
  SessionProvider,
  capabilitiesFor,
  useSession,
} from "@/components/auth/SessionProvider";
import type { SessionView } from "@/lib/sessionConfig";

// SessionProvider uses the router for its 401 handler; a stub is enough.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

function Probe() {
  const s = useSession();
  return (
    <div>
      <span data-testid="role">{s.role}</span>
      <span data-testid="canWrite">{String(s.canWrite)}</span>
      <span data-testid="canFilter">{String(s.canFilter)}</span>
      <span data-testid="canImport">{String(s.canImport)}</span>
      <span data-testid="canBackup">{String(s.canBackup)}</span>
      <span data-testid="isAdmin">{String(s.isAdmin)}</span>
      <span data-testid="auth">{String(s.isAuthenticated)}</span>
      <button onClick={s.markLapsed}>lapse</button>
    </div>
  );
}

function renderWith(
  initial: Pick<SessionView, "role" | "email"> & Partial<SessionView>,
) {
  const view: SessionView = {
    isImpersonating: false,
    impersonatedEmail: null,
    activeShowcase: null,
    ...initial,
  };
  render(
    <SessionProvider initial={view}>
      <Probe />
    </SessionProvider>,
  );
}

describe("capabilitiesFor", () => {
  it("maps each role to the backend capability matrix", () => {
    expect(capabilitiesFor("guest")).toEqual({
      canWrite: false,
      canFilter: true,
      canImport: false,
      canBackup: false,
      isAdmin: false,
    });
    expect(capabilitiesFor("trial")).toEqual({
      canWrite: true,
      canFilter: true,
      canImport: false,
      canBackup: true,
      isAdmin: false,
    });
    expect(capabilitiesFor("paid")).toEqual({
      canWrite: true,
      canFilter: true,
      canImport: true,
      canBackup: true,
      isAdmin: false,
    });
    expect(capabilitiesFor("lapsed")).toEqual({
      canWrite: false,
      canFilter: false,
      canImport: false,
      canBackup: true,
      isAdmin: false,
    });
    expect(capabilitiesFor("admin")).toEqual({
      canWrite: true,
      canFilter: true,
      canImport: true,
      canBackup: true,
      isAdmin: true,
    });
    // An unresolved role renders like lapsed: read + backup only.
    expect(capabilitiesFor("unknown")).toEqual({
      canWrite: false,
      canFilter: false,
      canImport: false,
      canBackup: true,
      isAdmin: false,
    });
  });
});

describe("SessionProvider capabilities", () => {
  it("guests may filter (the showcase) but not write, import, or back up", () => {
    renderWith({ role: "guest", email: null });
    expect(screen.getByTestId("role")).toHaveTextContent("guest");
    expect(screen.getByTestId("canWrite")).toHaveTextContent("false");
    expect(screen.getByTestId("canFilter")).toHaveTextContent("true");
    expect(screen.getByTestId("canImport")).toHaveTextContent("false");
    expect(screen.getByTestId("canBackup")).toHaveTextContent("false");
    expect(screen.getByTestId("auth")).toHaveTextContent("false");
  });

  it("trial accounts may write, filter, and back up — but not import", () => {
    renderWith({ role: "trial", email: "a@b.c" });
    expect(screen.getByTestId("canWrite")).toHaveTextContent("true");
    expect(screen.getByTestId("canFilter")).toHaveTextContent("true");
    expect(screen.getByTestId("canImport")).toHaveTextContent("false");
    expect(screen.getByTestId("canBackup")).toHaveTextContent("true");
    expect(screen.getByTestId("auth")).toHaveTextContent("true");
  });

  it("paid accounts may write, filter, import, and back up", () => {
    renderWith({ role: "paid", email: "a@b.c" });
    expect(screen.getByTestId("canWrite")).toHaveTextContent("true");
    expect(screen.getByTestId("canFilter")).toHaveTextContent("true");
    expect(screen.getByTestId("canImport")).toHaveTextContent("true");
    expect(screen.getByTestId("canBackup")).toHaveTextContent("true");
  });

  it("admin accounts get every capability plus the admin flag", () => {
    renderWith({ role: "admin", email: "a@b.c" });
    expect(screen.getByTestId("canImport")).toHaveTextContent("true");
    expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
  });

  it("lapsed accounts may back up but not write, filter, or import", () => {
    renderWith({ role: "lapsed", email: "a@b.c" });
    expect(screen.getByTestId("canWrite")).toHaveTextContent("false");
    expect(screen.getByTestId("canFilter")).toHaveTextContent("false");
    expect(screen.getByTestId("canImport")).toHaveTextContent("false");
    expect(screen.getByTestId("canBackup")).toHaveTextContent("true");
    expect(screen.getByTestId("auth")).toHaveTextContent("true");
  });

  it("an unknown role renders authenticated but restricted (like lapsed)", () => {
    renderWith({ role: "unknown", email: "a@b.c" });
    expect(screen.getByTestId("role")).toHaveTextContent("unknown");
    expect(screen.getByTestId("canWrite")).toHaveTextContent("false");
    expect(screen.getByTestId("canFilter")).toHaveTextContent("false");
    expect(screen.getByTestId("canImport")).toHaveTextContent("false");
    expect(screen.getByTestId("canBackup")).toHaveTextContent("true");
    expect(screen.getByTestId("auth")).toHaveTextContent("true");
  });

  it("markLapsed downgrades a paid session in place", () => {
    renderWith({ role: "paid", email: "a@b.c" });
    expect(screen.getByTestId("canWrite")).toHaveTextContent("true");
    act(() => {
      screen.getByRole("button", { name: "lapse" }).click();
    });
    expect(screen.getByTestId("role")).toHaveTextContent("lapsed");
    expect(screen.getByTestId("canWrite")).toHaveTextContent("false");
    expect(screen.getByTestId("canFilter")).toHaveTextContent("false");
    expect(screen.getByTestId("canImport")).toHaveTextContent("false");
  });
});
