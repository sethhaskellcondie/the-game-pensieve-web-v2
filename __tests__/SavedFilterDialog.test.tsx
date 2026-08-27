import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SavedFilterDialog from "@/components/home/SavedFilterDialog";
import type { SavedFilter } from "@/components/home/types";
import type { FilterSpecification } from "@/lib/api";

// A spec that advertises sorting (the "all_fields": "sort" capability marker)
// alongside two sortable text fields.
const sortableSpec: FilterSpecification = {
  type: "videoGame",
  fields: { title: "text", set: "text", all_fields: "sort" },
  filters: {
    title: ["equals", "contains"],
    set: ["equals", "contains"],
    all_fields: ["order_by", "order_by_desc"],
  },
};

// The same fields, from a backend that doesn't offer sorting at all.
const unsortableSpec: FilterSpecification = {
  type: "videoGame",
  fields: { title: "text", set: "text" },
  filters: { title: ["equals", "contains"], set: ["equals", "contains"] },
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

// Answers the three requests the dialog makes per entity: the filter spec, the
// entity's custom fields, and the systems list (for the system value picker).
function installFetch(spec: FilterSpecification) {
  global.fetch = jest.fn((url: string) => {
    if (String(url).includes("/api/filters/")) {
      return Promise.resolve(jsonResponse({ status: "ok", data: spec }));
    }
    return Promise.resolve(jsonResponse({ status: "ok", data: [] }));
  }) as unknown as typeof fetch;
}

const categories = [{ id: "c1", name: "Uncategorized" }];

// An existing saved filter to edit — one condition, so Save is enabled without
// having to build one through the filter editor.
function existing(overrides: Partial<SavedFilter> = {}): SavedFilter {
  return {
    id: "f1",
    name: "Recent",
    entity: "videoGame",
    conditions: [
      {
        id: "c1",
        field: "title",
        label: "Title",
        kind: "text",
        source: "standard",
        operator: "contains",
        operand: "Mario",
      },
    ],
    sorts: [],
    ...overrides,
  };
}

function renderDialog(
  props: Partial<React.ComponentProps<typeof SavedFilterDialog>> = {},
) {
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(
    <SavedFilterDialog
      categories={categories}
      initialCategoryId="c1"
      onSave={onSave}
      onClose={onClose}
      {...props}
    />,
  );
  return { onSave, onClose };
}

// Opens the sort popover and returns it.
async function openSortPopover() {
  fireEvent.click(await screen.findByRole("button", { name: "Sort" }));
  return screen.getByRole("dialog", { name: "Sort options" });
}

describe("SavedFilterDialog sorting", () => {
  it("offers the sort control once the entity's fields load", async () => {
    installFetch(sortableSpec);
    renderDialog();

    expect(
      await screen.findByRole("button", { name: "Sort" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Optional — without it the page keeps its own sorting."),
    ).toBeInTheDocument();
  });

  it("hides the sort control for an entity whose spec can't sort", async () => {
    installFetch(unsortableSpec);
    renderDialog();

    // The fields have loaded (Add filter is enabled) but sorting isn't offered.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Add filter/ })).toBeEnabled(),
    );
    expect(screen.queryByRole("button", { name: "Sort" })).not.toBeInTheDocument();
  });

  it("saves the chosen sort levels with the filter", async () => {
    installFetch(sortableSpec);
    const { onSave } = renderDialog({ initial: existing() });

    fireEvent.click(await screen.findByRole("button", { name: "Sort" }));
    fireEvent.click(screen.getByRole("button", { name: /Add sort/ }));

    // The first level defaults to the first field, ascending.
    expect(screen.getByText("Title ascending")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].sorts).toEqual([
      expect.objectContaining({
        field: "title",
        label: "Title",
        direction: "asc",
      }),
    ]);
  });

  it("prefills an edited filter's saved sort levels", async () => {
    installFetch(sortableSpec);
    renderDialog({
      initial: existing({
        sorts: [{ id: "s1", field: "set", label: "Set", direction: "desc" }],
      }),
    });

    expect(await screen.findByText("Set descending")).toBeInTheDocument();
  });

  it("dismisses the popover — not the dialog — when Escape is pressed", async () => {
    installFetch(sortableSpec);
    const { onClose } = renderDialog({ initial: existing() });

    const popover = await openSortPopover();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(popover).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // The dialog is still usable, and Escape now closes it as usual.
    expect(screen.getByRole("dialog", { name: "Edit Filter" })).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("dismisses the popover when the dialog itself is clicked", async () => {
    installFetch(sortableSpec);
    const { onClose } = renderDialog({ initial: existing() });

    const popover = await openSortPopover();
    // A press anywhere else in the dialog closes the popover and leaves the
    // dialog's own controls (Save, Cancel) reachable again.
    fireEvent.mouseDown(screen.getByRole("button", { name: "Save" }));

    expect(popover).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("still closes the dialog on a press outside it", async () => {
    installFetch(sortableSpec);
    const { onClose } = renderDialog({ initial: existing() });

    const dialog = await screen.findByRole("dialog", { name: "Edit Filter" });
    fireEvent.mouseDown(dialog.parentElement!);

    expect(onClose).toHaveBeenCalled();
  });

  it("clears the sort levels when the target collection changes", async () => {
    installFetch(sortableSpec);
    renderDialog({
      initial: existing({
        sorts: [{ id: "s1", field: "set", label: "Set", direction: "desc" }],
      }),
    });

    expect(await screen.findByText("Set descending")).toBeInTheDocument();

    // Switching entity invalidates levels built against the old field list.
    fireEvent.click(screen.getByRole("button", { name: "Applies to" }));
    fireEvent.click(await screen.findByRole("option", { name: "Toys" }));

    await waitFor(() =>
      expect(screen.queryByText("Set descending")).not.toBeInTheDocument(),
    );
    // Back to "no sorting chosen" for the new collection, not merely hidden.
    expect(
      screen.getByText("Optional — without it the page keeps its own sorting."),
    ).toBeInTheDocument();
  });
});
