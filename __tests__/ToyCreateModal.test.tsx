import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CustomField } from "@/lib/api";
import ToyCreateModal from "@/components/toys/ToyCreateModal";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

// No custom fields needed for these behaviors — the standard Name/Set rows are
// enough to exercise the create / reset / close paths.
const definitions: CustomField[] = [];

function renderModal({
  massInputMode = false,
  beginnerMode = false,
  onCreate = jest.fn().mockResolvedValue(true),
  onClose = jest.fn(),
}: {
  massInputMode?: boolean;
  beginnerMode?: boolean;
  onCreate?: jest.Mock;
  onClose?: jest.Mock;
} = {}) {
  render(
    <UiSettingsProvider
      initial={{ ...DEFAULT_UI_SETTINGS, massInputMode, beginnerMode }}
    >
      <ToyCreateModal
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

describe("ToyCreateModal", () => {
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

    it("submits the toy and closes on success", async () => {
      const { onCreate, onClose } = renderModal();
      typeName("R2-D2");
      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCreate).toHaveBeenCalledTimes(1);
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "R2-D2" }),
      );
    });
  });

  describe("beginner hint by the Create button", () => {
    const HINT = /turn on "Mass Input Mode" in the options/;

    it("shows the hint when beginner mode is on and mass input mode is off", () => {
      renderModal({ beginnerMode: true, massInputMode: false });
      const button = screen.getByRole("button", { name: "Beginner hint" });
      fireEvent.click(button);
      expect(screen.getByRole("tooltip")).toHaveTextContent(HINT);
    });

    it("swaps to the mass-input-on hint when mass input mode is on", () => {
      renderModal({ beginnerMode: true, massInputMode: true });
      const button = screen.getByRole("button", { name: "Beginner hint" });
      fireEvent.click(button);
      expect(screen.getByRole("tooltip")).toHaveTextContent(
        /Mass Input Mode is on, this create form will loop through inputs/,
      );
    });

    it("hides both hints while beginner mode is off", () => {
      renderModal({ beginnerMode: false, massInputMode: false });
      expect(
        screen.queryByRole("button", { name: "Beginner hint" }),
      ).not.toBeInTheDocument();
    });

    it("hides both hints while beginner mode is off even in mass input mode", () => {
      renderModal({ beginnerMode: false, massInputMode: true });
      expect(
        screen.queryByRole("button", { name: "Beginner hint" }),
      ).not.toBeInTheDocument();
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
      typeName("R2-D2");
      fireEvent.click(
        screen.getByRole("button", { name: "Create And Add Another" }),
      );

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
      // The dialog is still open and the entered name has been cleared.
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Create Toy" })).toBeVisible();
      await waitFor(() =>
        expect(screen.queryByText("R2-D2")).not.toBeInTheDocument(),
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
