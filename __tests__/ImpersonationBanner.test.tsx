import "@testing-library/jest-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import ImpersonationBanner from "@/components/auth/ImpersonationBanner";
import { SessionProvider } from "@/components/auth/SessionProvider";
import type { SessionView } from "@/lib/sessionConfig";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh }),
}));

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
      <ImpersonationBanner />
    </SessionProvider>,
  );
}

const originalFetch = global.fetch;

describe("ImpersonationBanner", () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("renders nothing when not impersonating", () => {
    renderWith({ role: "admin", email: "admin@x.com" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("names the admin, the target, and the effective role", () => {
    renderWith({
      role: "paid",
      email: "admin@x.com",
      isImpersonating: true,
      impersonatedEmail: "user@x.com",
    });
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("admin@x.com");
    expect(banner).toHaveTextContent("user@x.com");
    expect(banner).toHaveTextContent("PAID");
  });

  it("shows the Stop control regardless of the effective (non-admin) role", () => {
    // Impersonating a LAPSED user: the effective role can't do much, but Stop
    // must still be reachable (it keys off isImpersonating, not isAdmin).
    renderWith({
      role: "lapsed",
      email: "admin@x.com",
      isImpersonating: true,
      impersonatedEmail: "lapsed@x.com",
    });
    expect(
      screen.getByRole("button", { name: "Stop impersonating" }),
    ).toBeEnabled();
  });

  it("posts the stop endpoint and re-syncs the session on Stop", async () => {
    const fetchMock = jest.fn(async (input: string) => {
      const body =
        input === "/api/auth/session"
          ? {
              data: {
                role: "admin",
                email: "admin@x.com",
                isImpersonating: false,
                impersonatedEmail: null,
              },
            }
          : { status: "ok" };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    renderWith({
      role: "paid",
      email: "admin@x.com",
      isImpersonating: true,
      impersonatedEmail: "user@x.com",
    });

    await act(async () => {
      screen.getByRole("button", { name: "Stop impersonating" }).click();
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/impersonate/stop",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    // After stopping it re-reads the authoritative session view + re-renders RSC.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.anything(),
    );
    expect(refresh).toHaveBeenCalled();
  });
});
