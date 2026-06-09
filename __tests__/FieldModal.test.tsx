import "@testing-library/jest-dom";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import type { CustomField } from "@/lib/api";
import FieldModal, {
  type FieldModalSave,
} from "@/components/custom-fields/FieldModal";

// jsdom has no DataTransfer; the drag handlers only need these members.
const makeDataTransfer = () =>
  ({
    effectAllowed: "",
    setData: jest.fn(),
    getData: jest.fn(),
    setDragImage: jest.fn(),
  }) as unknown as DataTransfer;

// jsdom's drag events ignore `dataTransfer` and `clientY` from fireEvent's init
// (they're read-only getters / unsupported), so build the event and force the
// properties on directly before dispatching.
function fireDrag(
  type: "dragStart" | "dragOver" | "drop",
  node: Element,
  dataTransfer: DataTransfer,
  init: { clientY?: number } = {},
) {
  const event = createEvent[type](node);
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  if (init.clientY !== undefined) {
    Object.defineProperty(event, "clientY", { value: init.clientY });
  }
  fireEvent(node, event);
}

describe("FieldModal (create)", () => {
  it("disables Create until a name is entered", () => {
    render(
      <FieldModal
        mode="create"
        defaultEntityKey="boardGame"
        onSave={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    const save = screen.getByRole("button", { name: "Create field" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Field name"), {
      target: { value: "Designer" },
    });
    expect(save).toBeEnabled();
  });

  it("hides the options editor for non-enum types", () => {
    render(
      <FieldModal
        mode="create"
        defaultEntityKey="boardGame"
        onSave={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    // Default type is text → no "Add option".
    expect(
      screen.queryByRole("button", { name: /add option/i }),
    ).not.toBeInTheDocument();
  });

  it("builds a create payload with ordered options and a single default", () => {
    const onSave = jest.fn<void, [FieldModalSave]>();
    render(
      <FieldModal
        mode="create"
        defaultEntityKey="boardGame"
        onSave={onSave}
        onClose={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Field name"), {
      target: { value: "Theme" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Dropdown" }));

    fireEvent.click(screen.getByRole("button", { name: /add option/i }));
    fireEvent.change(screen.getByLabelText("Option 1"), {
      target: { value: "Fantasy" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add option/i }));
    fireEvent.change(screen.getByLabelText("Option 2"), {
      target: { value: "Sci-Fi" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create field" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual({
      mode: "create",
      input: {
        name: "Theme",
        type: "dropdown",
        entityKey: "boardGame",
        options: [
          { name: "Fantasy", order: 0, isDefault: true },
          { name: "Sci-Fi", order: 1, isDefault: false },
        ],
      },
    });
  });

  it("marks the user-selected option as the default", () => {
    const onSave = jest.fn<void, [FieldModalSave]>();
    render(
      <FieldModal
        mode="create"
        defaultEntityKey="boardGame"
        onSave={onSave}
        onClose={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Field name"), {
      target: { value: "Theme" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Dropdown" }));

    fireEvent.click(screen.getByRole("button", { name: /add option/i }));
    fireEvent.change(screen.getByLabelText("Option 1"), {
      target: { value: "Fantasy" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add option/i }));
    fireEvent.change(screen.getByLabelText("Option 2"), {
      target: { value: "Sci-Fi" },
    });

    // Promote the second option to default instead of the first.
    fireEvent.click(
      screen.getByRole("radio", { name: "Make option 2 the default" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create field" }));

    expect(onSave.mock.calls[0][0]).toEqual({
      mode: "create",
      input: {
        name: "Theme",
        type: "dropdown",
        entityKey: "boardGame",
        options: [
          { name: "Fantasy", order: 0, isDefault: false },
          { name: "Sci-Fi", order: 1, isDefault: true },
        ],
      },
    });
  });
});

describe("FieldModal (edit)", () => {
  const field: CustomField = {
    id: 42,
    name: "Theme",
    type: "dropdown",
    entityKey: "boardGame",
    order: 3,
    options: [
      { id: 100, customFieldId: 42, name: "Fantasy", isDefault: true, order: 0 },
      { id: 101, customFieldId: 42, name: "Sci-Fi", isDefault: false, order: 1 },
    ],
  };

  it("omits the type and entity controls entirely (neither can change)", () => {
    render(
      <FieldModal
        mode="edit"
        field={field}
        defaultEntityKey="boardGame"
        onSave={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    // The field-type picker is a radiogroup; default-option radios may still
    // appear, so assert the type picker specifically is gone.
    expect(
      screen.queryByRole("radiogroup", { name: "Field type" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Dropdown" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    // The read-only "Applies to" / "Field type" rows are removed in edit mode.
    expect(screen.queryByText(/applies to/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/field type/i)).not.toBeInTheDocument();
  });

  it("reorders options by dragging and saves the new order", () => {
    const onSave = jest.fn<void, [FieldModalSave]>();
    render(
      <FieldModal
        mode="edit"
        field={field}
        defaultEntityKey="boardGame"
        onSave={onSave}
        onClose={jest.fn()}
      />,
    );

    // Drag "Sci-Fi" (option 2) onto the top half of "Fantasy" (option 1) so it
    // drops before it. The default marker follows its option. jsdom reports a
    // zero-height rect, so a negative clientY lands in the row's "before" half.
    const grip2 = screen.getByLabelText("Reorder option 2");
    const row1 = screen.getByLabelText("Reorder option 1").parentElement!;

    const dataTransfer = makeDataTransfer();
    fireDrag("dragStart", grip2, dataTransfer);
    fireDrag("dragOver", row1, dataTransfer, { clientY: -5 });
    fireDrag("drop", row1, dataTransfer);

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave.mock.calls[0][0]).toEqual({
      mode: "edit",
      id: 42,
      input: {
        name: "Theme",
        order: 3,
        options: [
          { id: 101, name: "Sci-Fi", order: 0, isDefault: false },
          { id: 100, name: "Fantasy", order: 1, isDefault: true },
        ],
      },
    });
  });

  it("preserves option ids and the existing default on save", () => {
    const onSave = jest.fn<void, [FieldModalSave]>();
    render(
      <FieldModal
        mode="edit"
        field={field}
        defaultEntityKey="boardGame"
        onSave={onSave}
        onClose={jest.fn()}
      />,
    );

    // Append a brand-new option (no id) and save.
    fireEvent.click(screen.getByRole("button", { name: /add option/i }));
    fireEvent.change(screen.getByLabelText("Option 3"), {
      target: { value: "Horror" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual({
      mode: "edit",
      id: 42,
      input: {
        name: "Theme",
        order: 3,
        options: [
          { id: 100, name: "Fantasy", order: 0, isDefault: true },
          { id: 101, name: "Sci-Fi", order: 1, isDefault: false },
          { id: null, name: "Horror", order: 2, isDefault: false },
        ],
      },
    });
  });
});
