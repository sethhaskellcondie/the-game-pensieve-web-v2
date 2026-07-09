import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import DataTable, { type ColumnDef } from "@/components/data-table/DataTable";

// jsdom has no PointerEvent; back it with MouseEvent (which carries clientX)
// plus the pointerId the resize drag keys on, so fireEvent.pointer* works.
if (typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
    }
  }
  window.PointerEvent =
    PointerEventPolyfill as unknown as typeof window.PointerEvent;
}

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

  it("with confirmDelete, deletes only after confirming through the menu", () => {
    const onDelete = jest.fn();
    renderTable({
      onDelete,
      deleteLabel: (r) => `Delete ${r.name}`,
      confirmDelete: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete R2-D2" }));

    // The trash opens the "Are you sure?" menu instead of firing onDelete.
    const menu = screen.getByRole("menu", { name: "Delete R2-D2?" });
    expect(within(menu).getByText("Are you sure?")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(rows[0]);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("resizes a column by dragging its header handle with a pointer", () => {
    const { container } = renderTable();
    const handle = screen.getAllByTitle("Drag to resize")[0];

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 350 });

    // Name starts at 200; a +50px drag lands it at 250.
    const cols = container.querySelectorAll("col");
    expect(cols[0]).toHaveStyle({ width: "250px" });

    // A different pointer (e.g. a second finger) can't steer the drag.
    fireEvent.pointerMove(document, { pointerId: 2, clientX: 999 });
    expect(cols[0]).toHaveStyle({ width: "250px" });

    // Releasing ends the drag and restores the body cursor.
    fireEvent.pointerUp(document, { pointerId: 1 });
    expect(document.body.style.cursor).toBe("");
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 500 });
    expect(cols[0]).toHaveStyle({ width: "250px" });
  });

  it("with confirmDelete, an outside click dismisses the menu without deleting", () => {
    const onDelete = jest.fn();
    renderTable({
      onDelete,
      deleteLabel: (r) => `Delete ${r.name}`,
      confirmDelete: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete R2-D2" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
