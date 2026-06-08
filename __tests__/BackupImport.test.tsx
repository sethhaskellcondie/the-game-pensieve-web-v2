import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
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
});
