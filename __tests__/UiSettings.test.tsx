import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import UiSettings from "@/components/UiSettings";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";
import type { SessionView } from "@/lib/sessionConfig";

// SessionProvider reaches for the router; stub it.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

// Developer Mode is admin-only (see UiSettings), so the toggle tests render
// under an admin session; a dedicated test below covers the non-admin case.
const ADMIN_SESSION: SessionView = {
  role: "admin",
  email: "admin@example.com",
  isImpersonating: false,
  impersonatedEmail: null,
  accessUntil: null,
  activeShowcase: null,
};

// UiSettings now reads/writes through the UiSettingsProvider context, so it is
// rendered inside a provider seeded with the all-false defaults. The optimistic
// write fires a fetch to /api/ui-settings, which we stub out. The session view
// (admin by default) drives the admin-only Developer Mode toggle.
function renderWithProvider(session: SessionView = ADMIN_SESSION) {
  return render(
    <ToastProvider>
      <SessionProvider initial={session}>
        <UiSettingsProvider initial={DEFAULT_UI_SETTINGS}>
          <UiSettings />
        </UiSettingsProvider>
      </SessionProvider>
    </ToastProvider>,
  );
}

describe("UiSettings", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("renders the five interface toggles, all off by default", () => {
    renderWithProvider();
    for (const name of [
      "Mass Input Mode",
      "Mass Edit Mode",
      "Developer Mode",
      "Hide Animations",
      "Beginner Mode",
    ]) {
      expect(screen.getByRole("switch", { name })).toHaveAttribute(
        "aria-checked",
        "false",
      );
    }
  });

  it("hides the Developer Mode toggle from non-admins", () => {
    renderWithProvider({ ...ADMIN_SESSION, role: "paid" });
    expect(
      screen.queryByRole("switch", { name: "Developer Mode" }),
    ).not.toBeInTheDocument();
    // The other toggles are unaffected.
    expect(
      screen.getByRole("switch", { name: "Mass Input Mode" }),
    ).toBeInTheDocument();
  });

  it("flips only the clicked toggle once the write is confirmed", async () => {
    renderWithProvider();
    const massInput = screen.getByRole("switch", { name: "Mass Input Mode" });
    const developer = screen.getByRole("switch", { name: "Developer Mode" });

    fireEvent.click(massInput);

    await waitFor(() =>
      expect(massInput).toHaveAttribute("aria-checked", "true"),
    );
    expect(developer).toHaveAttribute("aria-checked", "false");
  });

  it("renders the standard-fields row with a Set Fields button", () => {
    renderWithProvider();
    expect(screen.getByText("Show/Hide Standard Fields")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set Fields" }),
    ).toBeInTheDocument();
  });

  it("opens the standard fields dialog with every field shown by default", () => {
    renderWithProvider();
    fireEvent.click(screen.getByRole("button", { name: "Set Fields" }));

    const dialog = screen.getByRole("dialog", {
      name: "Show/Hide Standard Fields",
    });
    for (const name of [
      "Toys: Set",
      "System: Generation",
      "System: Handheld",
      "Board Game: Boxes",
      "Board Game Box: Board Game",
      "Board Game Box: Expansion",
      "Board Game Box: Stand Alone",
      "Board Game Box: Base Set",
      "Video Game: System",
      "Video Game: Boxes",
      "Video Game Box: System",
      "Video Game Box: Games",
      "Video Game Box: Physical",
      "Video Game Box: Collection",
    ]) {
      // Each field renders the shared Yes/No pill; "Yes" means shown.
      expect(
        within(dialog).getByRole("button", { name: `${name}: Yes` }),
      ).toHaveAttribute("aria-pressed", "true");
    }
  });

  it("stages field changes locally and persists them on Save Fields", async () => {
    renderWithProvider();
    fireEvent.click(screen.getByRole("button", { name: "Set Fields" }));
    const dialog = screen.getByRole("dialog", {
      name: "Show/Hide Standard Fields",
    });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Toys: Set: Yes" }),
    );
    expect(
      within(dialog).getByRole("button", { name: "Toys: Set: No" }),
    ).toHaveAttribute("aria-pressed", "false");
    // Flipping only stages the change; nothing is written until Save.
    expect(mockFetch).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save Fields" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Show/Hide Standard Fields" }),
      ).not.toBeInTheDocument(),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.standardFields.toy.set).toBe(false);
    expect(body.standardFields.system.generation).toBe(true);
  });

  it("discards staged field changes on Cancel", () => {
    renderWithProvider();
    fireEvent.click(screen.getByRole("button", { name: "Set Fields" }));
    let dialog = screen.getByRole("dialog", {
      name: "Show/Hide Standard Fields",
    });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Toys: Set: Yes" }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("dialog", { name: "Show/Hide Standard Fields" }),
    ).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();

    // Reopening shows the saved state again, not the discarded draft.
    fireEvent.click(screen.getByRole("button", { name: "Set Fields" }));
    dialog = screen.getByRole("dialog", {
      name: "Show/Hide Standard Fields",
    });
    expect(
      within(dialog).getByRole("button", { name: "Toys: Set: Yes" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("renders a default-view choice per collection with List selected by default", () => {
    renderWithProvider();

    for (const name of [
      "Default Video Games View",
      "Default Board Games View",
    ]) {
      const group = screen.getByRole("radiogroup", { name });
      expect(within(group).getByRole("radio", { name: "List" })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(
        within(group).getByRole("radio", { name: "Shelf" }),
      ).toHaveAttribute("aria-checked", "false");
    }
  });

  it("selects Shelf for video games and persists it once the write is confirmed", async () => {
    renderWithProvider();
    const group = screen.getByRole("radiogroup", {
      name: "Default Video Games View",
    });
    const shelf = within(group).getByRole("radio", { name: "Shelf" });

    fireEvent.click(shelf);

    await waitFor(() => expect(shelf).toHaveAttribute("aria-checked", "true"));
    expect(within(group).getByRole("radio", { name: "List" })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.videoGamesDefaultView).toBe("shelf");
    expect(body.boardGamesDefaultView).toBe("list");
  });

  it("selects Shelf for board games without touching the video games choice", async () => {
    renderWithProvider();
    const boardGroup = screen.getByRole("radiogroup", {
      name: "Default Board Games View",
    });
    const shelf = within(boardGroup).getByRole("radio", { name: "Shelf" });

    fireEvent.click(shelf);

    await waitFor(() => expect(shelf).toHaveAttribute("aria-checked", "true"));
    const videoGroup = screen.getByRole("radiogroup", {
      name: "Default Video Games View",
    });
    expect(
      within(videoGroup).getByRole("radio", { name: "List" }),
    ).toHaveAttribute("aria-checked", "true");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.boardGamesDefaultView).toBe("shelf");
    expect(body.videoGamesDefaultView).toBe("list");
  });
});
