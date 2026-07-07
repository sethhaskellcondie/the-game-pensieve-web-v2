import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BackupImport from "@/components/BackupImport";
import { ToastProvider } from "@/components/ToastProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";
import { backupFilename, downloadTextFile } from "@/lib/download";
import type { Role } from "@/lib/sessionConfig";

jest.mock("@/lib/download", () => ({
  downloadTextFile: jest.fn(),
  backupFilename: jest.fn(() => "backup-2026-06-08T14-30-00Z.txt"),
}));

// SessionProvider (used by the capability-gating tests) reaches for the router.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const mockDownloadTextFile = downloadTextFile as jest.Mock;
const mockBackupFilename = backupFilename as jest.Mock;

const OPTION_LABELS = [
  "Backup Data",
  "Import From File",
  "Import From Backup",
  "Seed Sample Data",
  "Seed Seth's Data",
];

// Restore-from-backup and Seth's seed data only appear in developer mode.
const DEVELOPER_ONLY_LABELS = ["Import From Backup", "Seed Seth's Data"];

// Render inside the ToastProvider so seed outcomes can surface their toast,
// and a UiSettingsProvider with developer mode on so every action is present.
function renderBackupImport({ developerMode = true } = {}) {
  return render(
    <UiSettingsProvider initial={{ ...DEFAULT_UI_SETTINGS, developerMode }}>
      <ToastProvider>
        <BackupImport />
      </ToastProvider>
    </UiSettingsProvider>,
  );
}

describe("BackupImport", () => {
  it("renders the Backup & Import section heading", () => {
    renderBackupImport();
    expect(
      screen.getByRole("heading", { level: 2, name: "Backup & Import" }),
    ).toBeInTheDocument();
  });

  it("renders a button for each of the five options in developer mode", () => {
    renderBackupImport();
    for (const label of OPTION_LABELS) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")).toHaveLength(OPTION_LABELS.length);
  });

  it("hides the developer-only options when developer mode is disabled", () => {
    renderBackupImport({ developerMode: false });
    for (const label of DEVELOPER_ONLY_LABELS) {
      expect(
        screen.queryByRole("button", { name: label }),
      ).not.toBeInTheDocument();
    }
    const visibleLabels = OPTION_LABELS.filter(
      (label) => !DEVELOPER_ONLY_LABELS.includes(label),
    );
    for (const label of visibleLabels) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")).toHaveLength(visibleLabels.length);
  });

  describe("Seed Sample Data", () => {
    const mockFetch = jest.fn();

    beforeEach(() => {
      global.fetch = mockFetch as unknown as typeof fetch;
    });

    afterEach(() => {
      mockFetch.mockReset();
    });

    it("POSTs to the seed route and disables every button while seeding", async () => {
      // Hold the request open so we can assert the in-flight (disabled) state.
      let resolveFetch: (value: Response) => void = () => {};
      mockFetch.mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      );

      renderBackupImport();
      fireEvent.click(screen.getByRole("button", { name: "Seed Sample Data" }));

      expect(mockFetch).toHaveBeenCalledWith("/api/seed-sample-data", {
        method: "POST",
      });

      // The triggering button shows progress, and the five action buttons
      // disable while the request is in flight.
      const seedingButton = await screen.findByRole("button", {
        name: "Seeding…",
      });
      expect(seedingButton).toBeDisabled();
      for (const label of OPTION_LABELS.filter((l) => l !== "Seed Sample Data")) {
        expect(screen.getByRole("button", { name: label })).toBeDisabled();
      }

      resolveFetch({ ok: true, status: 200 } as Response);

      // Once the server responds, the buttons re-enable and the label resets.
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Seed Sample Data" }),
        ).toBeEnabled();
      });
    });

    it("shows a success toast when seeding succeeds", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      renderBackupImport();
      fireEvent.click(screen.getByRole("button", { name: "Seed Sample Data" }));

      expect(
        await screen.findByText("Sample data seeded successfully."),
      ).toBeInTheDocument();
    });

    it("surfaces the backend error detail in the snackbar on a non-OK response", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({
          status: "error",
          message:
            "Backend request failed: 500 Error (/function/seedSampleData): table already seeded",
        }),
      } as unknown as Response);

      renderBackupImport();
      fireEvent.click(screen.getByRole("button", { name: "Seed Sample Data" }));

      expect(
        await screen.findByText(/table already seeded/),
      ).toBeInTheDocument();

      (console.error as jest.Mock).mockRestore();
    });

    it("shows an error toast and re-enables the buttons when the request fails", async () => {
      mockFetch.mockRejectedValue(new Error("network down"));
      jest.spyOn(console, "error").mockImplementation(() => {});

      renderBackupImport();
      fireEvent.click(screen.getByRole("button", { name: "Seed Sample Data" }));

      expect(
        await screen.findByText("Couldn't seed sample data. Please try again."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Seed Sample Data" }),
      ).toBeEnabled();

      (console.error as jest.Mock).mockRestore();
    });
  });

  describe("Import From File", () => {
    const mockFetch = jest.fn();

    function selectFile(container: HTMLElement, contents: string) {
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File([contents], "backup.txt", { type: "text/plain" });
      fireEvent.change(input, { target: { files: [file] } });
    }

    beforeEach(() => {
      global.fetch = mockFetch as unknown as typeof fetch;
    });

    afterEach(() => {
      mockFetch.mockReset();
    });

    it("clicking the button opens the hidden file picker", () => {
      const { container } = renderBackupImport();
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const clickSpy = jest.spyOn(input, "click").mockImplementation(() => {});

      fireEvent.click(
        screen.getByRole("button", { name: "Import From File" }),
      );

      expect(clickSpy).toHaveBeenCalledTimes(1);
      clickSpy.mockRestore();
    });

    it("POSTs the selected file's contents to the import route and toasts on success", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);
      const contents = '{"toys":[{"id":"1"}],"systems":[]}';

      const { container } = renderBackupImport();
      selectFile(container, contents);

      await waitFor(() =>
        expect(mockFetch).toHaveBeenCalledWith("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: contents,
        }),
      );
      expect(
        await screen.findByText("Data imported from file successfully."),
      ).toBeInTheDocument();
    });

    it("rejects an invalid-JSON file without calling the server", async () => {
      const { container } = renderBackupImport();
      selectFile(container, "this is not json");

      expect(
        await screen.findByText(/isn't valid JSON/),
      ).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("surfaces the backend error detail on a non-OK response", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({
          status: "error",
          message:
            "Backend request failed: 400 Error (/function/import): duplicate key",
        }),
      } as unknown as Response);

      const { container } = renderBackupImport();
      selectFile(container, '{"toys":[]}');

      expect(await screen.findByText(/duplicate key/)).toBeInTheDocument();

      (console.error as jest.Mock).mockRestore();
    });

    it("shows an error snackbar and re-enables the buttons when the request fails", async () => {
      mockFetch.mockRejectedValue(new Error("network down"));
      jest.spyOn(console, "error").mockImplementation(() => {});

      const { container } = renderBackupImport();
      selectFile(container, '{"toys":[]}');

      expect(
        await screen.findByText("Couldn't import from file. Please try again."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Import From File" }),
      ).toBeEnabled();

      (console.error as jest.Mock).mockRestore();
    });
  });

  describe("Import From Backup", () => {
    const mockFetch = jest.fn();

    beforeEach(() => {
      global.fetch = mockFetch as unknown as typeof fetch;
    });

    afterEach(() => {
      mockFetch.mockReset();
    });

    it("POSTs to the import route and disables every button while importing", async () => {
      let resolveFetch: (value: Response) => void = () => {};
      mockFetch.mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      );

      renderBackupImport();
      fireEvent.click(
        screen.getByRole("button", { name: "Import From Backup" }),
      );

      expect(mockFetch).toHaveBeenCalledWith("/api/import-from-backup", {
        method: "POST",
      });

      const importingButton = await screen.findByRole("button", {
        name: "Importing…",
      });
      expect(importingButton).toBeDisabled();
      for (const label of OPTION_LABELS.filter(
        (l) => l !== "Import From Backup",
      )) {
        expect(screen.getByRole("button", { name: label })).toBeDisabled();
      }

      resolveFetch({ ok: true, status: 200 } as Response);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Import From Backup" }),
        ).toBeEnabled();
      });
    });

    it("shows a success toast when the import succeeds", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      renderBackupImport();
      fireEvent.click(
        screen.getByRole("button", { name: "Import From Backup" }),
      );

      expect(
        await screen.findByText("Data imported from backup successfully."),
      ).toBeInTheDocument();
    });

    it("surfaces the backend error detail in the snackbar on a non-OK response", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({
          status: "error",
          message:
            "Backend request failed: 500 Error (/function/importFromFile): backup.json not found",
        }),
      } as unknown as Response);

      renderBackupImport();
      fireEvent.click(
        screen.getByRole("button", { name: "Import From Backup" }),
      );

      expect(
        await screen.findByText(/backup\.json not found/),
      ).toBeInTheDocument();

      (console.error as jest.Mock).mockRestore();
    });

    it("shows an error snackbar and re-enables the buttons when the request fails", async () => {
      mockFetch.mockRejectedValue(new Error("network down"));
      jest.spyOn(console, "error").mockImplementation(() => {});

      renderBackupImport();
      fireEvent.click(
        screen.getByRole("button", { name: "Import From Backup" }),
      );

      expect(
        await screen.findByText("Couldn't import from backup. Please try again."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Import From Backup" }),
      ).toBeEnabled();

      (console.error as jest.Mock).mockRestore();
    });
  });

  describe("Backup Data", () => {
    const mockFetch = jest.fn();

    beforeEach(() => {
      global.fetch = mockFetch as unknown as typeof fetch;
      mockBackupFilename.mockReturnValue("backup-2026-06-08T14-30-00Z.txt");
    });

    afterEach(() => {
      mockFetch.mockReset();
      mockDownloadTextFile.mockReset();
    });

    it("POSTs to the backup route and downloads the pretty-printed data on success", async () => {
      const data = { toys: [{ id: "1" }], systems: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", data }),
      } as unknown as Response);

      renderBackupImport();
      fireEvent.click(screen.getByRole("button", { name: "Backup Data" }));

      expect(mockFetch).toHaveBeenCalledWith("/api/backup", { method: "POST" });

      await waitFor(() => expect(mockDownloadTextFile).toHaveBeenCalledTimes(1));
      const [filename, contents] = mockDownloadTextFile.mock.calls[0];
      expect(filename).toMatch(/^backup-.+Z\.txt$/);
      expect(contents).toBe(JSON.stringify(data, null, 2));
      expect(
        await screen.findByText("Backup downloaded."),
      ).toBeInTheDocument();
    });

    it("shows progress and disables every button while backing up", async () => {
      let resolveFetch: (value: Response) => void = () => {};
      mockFetch.mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      );

      renderBackupImport();
      fireEvent.click(screen.getByRole("button", { name: "Backup Data" }));

      const backingUpButton = await screen.findByRole("button", {
        name: "Backing up…",
      });
      expect(backingUpButton).toBeDisabled();
      for (const label of OPTION_LABELS.filter((l) => l !== "Backup Data")) {
        expect(screen.getByRole("button", { name: label })).toBeDisabled();
      }

      resolveFetch({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", data: {} }),
      } as unknown as Response);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Backup Data" }),
        ).toBeEnabled();
      });
    });

    it("surfaces the backend error detail and does not download on a non-OK response", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ status: "error", message: "backend exploded" }),
      } as unknown as Response);

      renderBackupImport();
      fireEvent.click(screen.getByRole("button", { name: "Backup Data" }));

      expect(await screen.findByText(/backend exploded/)).toBeInTheDocument();
      expect(mockDownloadTextFile).not.toHaveBeenCalled();

      (console.error as jest.Mock).mockRestore();
    });

    it("shows an error snackbar and re-enables the buttons when the request fails", async () => {
      mockFetch.mockRejectedValue(new Error("network down"));
      jest.spyOn(console, "error").mockImplementation(() => {});

      renderBackupImport();
      fireEvent.click(screen.getByRole("button", { name: "Backup Data" }));

      expect(
        await screen.findByText("Couldn't back up data. Please try again."),
      ).toBeInTheDocument();
      expect(mockDownloadTextFile).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Backup Data" })).toBeEnabled();

      (console.error as jest.Mock).mockRestore();
    });
  });

  describe("capability gating", () => {
    function renderForRole(role: Role) {
      return render(
        <SessionProvider
          initial={{
            role,
            email: "a@b.c",
            isImpersonating: false,
            impersonatedEmail: null,
            accessUntil: null,
            activeShowcase: null,
          }}
        >
          <UiSettingsProvider
            initial={{ ...DEFAULT_UI_SETTINGS, developerMode: true }}
          >
            <ToastProvider>
              <BackupImport />
            </ToastProvider>
          </UiSettingsProvider>
        </SessionProvider>,
      );
    }

    it("enables import and backup for a paid account", () => {
      renderForRole("paid");
      expect(
        screen.getByRole("button", { name: "Import From File" }),
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Import From Backup" }),
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Seed Sample Data" }),
      ).toBeEnabled();
      expect(screen.getByRole("button", { name: "Backup Data" })).toBeEnabled();
    });

    it("disables import but allows backup for a trial account", () => {
      renderForRole("trial");
      // Import is paid-only — a TRIAL is gated out before it can 403.
      expect(
        screen.getByRole("button", { name: "Import From File" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Import From Backup" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Seed Sample Data" }),
      ).toBeDisabled();
      // Backup needs only an authenticated role.
      expect(screen.getByRole("button", { name: "Backup Data" })).toBeEnabled();
    });

    it("disables import but allows backup for a lapsed account", () => {
      renderForRole("lapsed");
      expect(
        screen.getByRole("button", { name: "Import From File" }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Backup Data" })).toBeEnabled();
    });
  });
});
