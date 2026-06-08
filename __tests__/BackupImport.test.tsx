import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BackupImport from "@/components/BackupImport";

const OPTION_LABELS = [
  "Backup Data",
  "Import From File",
  "Import From Backup",
  "Seed Sample Data",
  "Seed Seth's Data",
];

describe("BackupImport", () => {
  it("renders the Backup & Import section heading", () => {
    render(<BackupImport />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Backup & Import" }),
    ).toBeInTheDocument();
  });

  it("renders a button for each of the five options", () => {
    render(<BackupImport />);
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

      render(<BackupImport />);
      fireEvent.click(screen.getByRole("button", { name: "Seed Sample Data" }));

      expect(mockFetch).toHaveBeenCalledWith("/api/seed-sample-data", {
        method: "POST",
      });

      // The triggering button shows progress, and all five buttons disable.
      const seedingButton = await screen.findByRole("button", {
        name: "Seeding…",
      });
      expect(seedingButton).toBeDisabled();
      for (const button of screen.getAllByRole("button")) {
        expect(button).toBeDisabled();
      }

      resolveFetch({ ok: true, status: 200 } as Response);

      // Once the server responds, the buttons re-enable and the label resets.
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Seed Sample Data" }),
        ).toBeEnabled();
      });
      for (const button of screen.getAllByRole("button")) {
        expect(button).toBeEnabled();
      }
    });

    it("re-enables the buttons when the request fails", async () => {
      mockFetch.mockRejectedValue(new Error("network down"));
      jest.spyOn(console, "error").mockImplementation(() => {});

      render(<BackupImport />);
      fireEvent.click(screen.getByRole("button", { name: "Seed Sample Data" }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Seed Sample Data" }),
        ).toBeEnabled();
      });

      (console.error as jest.Mock).mockRestore();
    });
  });
});
