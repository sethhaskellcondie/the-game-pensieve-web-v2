import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CustomField } from "@/lib/api";
import SystemCreateModal from "@/components/systems/SystemCreateModal";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

// No custom fields needed for these behaviors — the standard Name/Generation/
// Handheld rows are enough to exercise the create / reset / close paths.
const definitions: CustomField[] = [];

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
      <SystemCreateModal
        definitions={definitions}
        saving={false}
        onCreate={onCreate}
        onClose={onClose}
      />
    </UiSettingsProvider>,
  );
  return { onCreate, onClose };
}

// Drive the click-to-edit Name editor: open it, type, and commit with Enter.
function typeName(value: string) {
  fireEvent.click(screen.getByRole("button", { name: "Edit Name" }));
  const input = screen.getByRole("textbox", { name: "Name" });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

// Drive the click-to-edit Generation editor the same way (a number input).
function typeGeneration(value: string) {
  fireEvent.click(screen.getByRole("button", { name: "Edit Generation" }));
  const input = screen.getByRole("spinbutton", { name: "Generation" });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("SystemCreateModal", () => {
  describe("normal mode", () => {
    it("labels the button Create and shows a Cancel button", () => {
      renderModal();
      expect(
        screen.getByRole("button", { name: "Create" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
    });

    it("renders the Name, Generation, and Handheld standard rows", () => {
      renderModal();
      expect(screen.getByRole("button", { name: "Edit Name" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Edit Generation" }),
      ).toBeInTheDocument();
      // Handheld is a required boolean and defaults to No.
      expect(
        screen.getByRole("button", { name: "Handheld: No" }),
      ).toBeInTheDocument();
    });

    it("keeps Create disabled until both Name and Generation are entered", () => {
      renderModal();
      const create = screen.getByRole("button", { name: "Create" });
      expect(create).toBeDisabled();

      typeName("Switch");
      expect(create).toBeDisabled();

      typeGeneration("9");
      expect(create).toBeEnabled();
    });

    it("submits the system with a numeric generation and boolean handheld, then closes", async () => {
      const { onCreate, onClose } = renderModal();
      typeName("Switch");
      typeGeneration("9");
      fireEvent.click(screen.getByRole("button", { name: "Handheld: No" }));
      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCreate).toHaveBeenCalledTimes(1);
      expect(onCreate).toHaveBeenCalledWith({
        name: "Switch",
        generation: 9,
        handheld: true,
        customFieldValues: [],
      });
    });

    it("defaults handheld to false when the toggle is untouched", async () => {
      const { onCreate } = renderModal();
      typeName("NES");
      typeGeneration("3");
      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ handheld: false }),
      );
    });
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
      typeName("Switch");
      typeGeneration("9");
      fireEvent.click(screen.getByRole("button", { name: "Handheld: No" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Create And Add Another" }),
      );

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
      // The dialog is still open and the entered values have been cleared:
      // name gone, generation back to Empty, handheld back to No.
      expect(onClose).not.toHaveBeenCalled();
      expect(
        screen.getByRole("dialog", { name: "Create System" }),
      ).toBeVisible();
      await waitFor(() =>
        expect(screen.queryByText("Switch")).not.toBeInTheDocument(),
      );
      expect(
        screen.getByRole("button", { name: "Edit Generation" }),
      ).toHaveTextContent("Empty");
      expect(
        screen.getByRole("button", { name: "Handheld: No" }),
      ).toBeInTheDocument();
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
