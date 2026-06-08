import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BackupImport from "@/components/BackupImport";
import { ToastProvider } from "@/components/ToastProvider";

const OPTION_LABELS = [
  "Backup Data",
  "Import From File",
  "Import From Backup",
  "Seed Sample Data",
  "Seed Seth's Data",
];

// Render inside the ToastProvider so seed outcomes can surface their toast.
function renderBackupImport() {
  return render(
    <ToastProvider>
      <BackupImport />
    </ToastProvider>,
  );
}

describe("BackupImport", () => {
  it("renders the Backup & Import section heading", () => {
    renderBackupImport();
    expect(
      screen.getByRole("heading", { level: 2, name: "Backup & Import" }),
    ).toBeInTheDocument();
  });

  it("renders a button for each of the five options", () => {
    renderBackupImport();
    for (const label of OPTION_LABELS) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")).toHaveLength(OPTION_LABELS.length);
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
});
