import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CustomField } from "@/lib/api";
import BoardGameCreateModal from "@/components/board-games/BoardGameCreateModal";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

// One custom field is enough to exercise the values plumbing; the standard
// Title row covers the create / reset / close paths.
const definitions: CustomField[] = [
  { id: 9, name: "Designer", type: "text", entityKey: "boardGame", order: 0, options: [] },
];

function renderModal({
  massInputMode = false,
  onCreate = jest.fn().mockResolvedValue(true),
  onClose = jest.fn(),
}: {
  massInputMode?: boolean;
  onCreate?: jest.Mock;
  onClose?: jest.Mock;
} = {}) {
  render(
    <UiSettingsProvider initial={{ ...DEFAULT_UI_SETTINGS, massInputMode }}>
      <BoardGameCreateModal
        definitions={definitions}
        saving={false}
        onCreate={onCreate}
        onClose={onClose}
      />
    </UiSettingsProvider>,
  );
  return { onCreate, onClose };
}

// Drive a click-to-edit text editor: open it, type, and commit with Enter.
function typeField(name: string, value: string) {
  fireEvent.click(screen.getByRole("button", { name: `Edit ${name}` }));
  const input = screen.getByRole("textbox", { name });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("BoardGameCreateModal", () => {
  it("renders no System row (board games have no system)", () => {
    renderModal();
    expect(
      screen.queryByRole("button", { name: "System" }),
    ).not.toBeInTheDocument();
  });

  it("disables Create until a title is entered", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    typeField("Title", "Settlers of Catan");
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("submits the game (with its non-empty custom-field values) and closes on success", async () => {
    const { onCreate, onClose } = renderModal();
    typeField("Title", "  Settlers of Catan  ");
    typeField("Designer", "Klaus Teuber");

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      title: "Settlers of Catan",
      customFieldValues: [
        {
          customFieldId: 9,
          customFieldName: "Designer",
          customFieldType: "text",
          value: "Klaus Teuber",
        },
      ],
    });
  });

  it("closes on Escape outside mass-input mode", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe("mass-input mode", () => {
    it("labels the button Create And Add Another and keeps Cancel", () => {
      renderModal({ massInputMode: true });
      expect(
        screen.getByRole("button", { name: "Create And Add Another" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
    });

    it("clears the form and stays open after a successful create", async () => {
      const { onCreate, onClose } = renderModal({ massInputMode: true });
      typeField("Title", "Settlers of Catan");
      fireEvent.click(
        screen.getByRole("button", { name: "Create And Add Another" }),
      );

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
      // The dialog is still open with the title cleared.
      expect(onClose).not.toHaveBeenCalled();
      expect(
        screen.getByRole("dialog", { name: "Create Board Game" }),
      ).toBeVisible();
      await waitFor(() =>
        expect(
          screen.queryByText("Settlers of Catan"),
        ).not.toBeInTheDocument(),
      );
    });

    it("does not close on Escape; the close button still exits", () => {
      const { onClose } = renderModal({ massInputMode: true });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
