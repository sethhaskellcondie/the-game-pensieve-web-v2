import { render, screen } from "@testing-library/react";
import ShowcaseBanner from "@/components/auth/ShowcaseBanner";
import { SessionProvider } from "@/components/auth/SessionProvider";
import type { SessionView } from "@/lib/sessionConfig";

let pathname = "/";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => pathname,
}));

function renderWith(
  initial: Pick<SessionView, "role"> & Partial<SessionView>,
) {
  const view: SessionView = {
    email: null,
    isImpersonating: false,
    impersonatedEmail: null,
    accessUntil: null,
    activeShowcase: null,
    ...initial,
  };
  return render(
    <SessionProvider initial={view}>
      <ShowcaseBanner />
    </SessionProvider>,
  );
}

const ACTIVE = { slug: "showcase-one", name: "Showcase One" };

beforeEach(() => {
  pathname = "/";
});

describe("ShowcaseBanner", () => {
  it("shows the default-showcase notice to anonymous visitors with no selection", () => {
    renderWith({ role: "guest" });
    expect(screen.getByRole("status")).toHaveTextContent(
      /viewing the public showcase/i,
    );
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("is absent for an authenticated user with no selection", () => {
    renderWith({ role: "paid", email: "c@x.z" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("names the showcase and offers the way home to an authenticated viewer", () => {
    renderWith({ role: "paid", email: "c@x.z", activeShowcase: ACTIVE });
    expect(screen.getByRole("status")).toHaveTextContent(
      /viewing\s+Showcase One\s+\(read-only\)/i,
    );
    expect(
      screen.getByRole("button", { name: /back to my collection/i }),
    ).toBeInTheDocument();
  });

  it("offers log in (not 'back') to an anonymous showcase viewer", () => {
    renderWith({ role: "guest", activeShowcase: ACTIVE });
    expect(screen.getByRole("status")).toHaveTextContent(/Showcase One/);
    expect(
      screen.queryByRole("button", { name: /back to my collection/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
  });

  it("stays hidden on the auth and marketing pages", () => {
    for (const p of ["/login", "/signup", "/pricing"]) {
      pathname = p;
      const { unmount } = renderWith({ role: "guest", activeShowcase: ACTIVE });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      unmount();
    }
  });
});
