import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import DataTable, { type ColumnDef } from "@/components/data-table/DataTable";

type Row = { id: number; name: string; set: string };

const rows: Row[] = [
  { id: 1, name: "R2-D2", set: "Star Wars" },
  { id: 2, name: "Pikachu", set: "Pokemon" },
];

const columns: ColumnDef<Row>[] = [
  { key: "name", label: "Name", width: 200, render: (r) => r.name },
  { key: "set", label: "Set", width: 160, render: (r) => r.set },
];

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return render(
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      loading={false}
      emptyMessage="No rows."
      loadingMessage="Loading…"
      {...props}
    />,
  );
}

describe("DataTable", () => {
  it("renders a column header per column definition", () => {
    renderTable();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Set" })).toBeInTheDocument();
  });

  it("renders a cell per row using the column's render", () => {
    renderTable();
    expect(screen.getByText("R2-D2")).toBeInTheDocument();
    expect(screen.getByText("Star Wars")).toBeInTheDocument();
    expect(screen.getByText("Pikachu")).toBeInTheDocument();
  });

  it("shows the loading message when loading with no rows", () => {
    renderTable({ rows: [], loading: true });
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows the empty message when not loading with no rows", () => {
    renderTable({ rows: [], loading: false });
    expect(screen.getByText("No rows.")).toBeInTheDocument();
  });

  it("renders a delete column and calls onDelete with the row when clicked", () => {
    const onDelete = jest.fn();
    renderTable({ onDelete, deleteLabel: (r) => `Delete ${r.name}` });

    fireEvent.click(screen.getByRole("button", { name: "Delete R2-D2" }));
    expect(onDelete).toHaveBeenCalledWith(rows[0]);
  });

  it("omits the delete column when onDelete is not provided", () => {
    renderTable();
    expect(
      screen.queryByRole("columnheader", { name: "Delete" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Delete / }),
    ).not.toBeInTheDocument();
  });
});
