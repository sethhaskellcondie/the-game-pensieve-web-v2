import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CustomField } from "@/lib/api";
import FieldModal, {
  type FieldModalSave,
} from "@/components/custom-fields/FieldModal";

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

  it("locks type and entity (no picker, no select)", () => {
    render(
      <FieldModal
        mode="edit"
        field={field}
        defaultEntityKey="boardGame"
        onSave={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/type can't be changed/i)).toBeInTheDocument();
    expect(screen.getByText(/can't be reassigned/i)).toBeInTheDocument();
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
