import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CustomField, System } from "@/lib/api";
import VideoGameCreateModal from "@/components/video-games/VideoGameCreateModal";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

// No custom fields needed for these behaviors — the standard Title/System rows
// are enough to exercise the create / reset / close paths.
const definitions: CustomField[] = [];

const systems: System[] = [
  { id: 1, key: "system", name: "NES", generation: 3, handheld: false, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
  { id: 2, key: "system", name: "SNES", generation: 4, handheld: false, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
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
      <VideoGameCreateModal
        definitions={definitions}
        systems={systems}
        defaultSystemId={2}
        saving={false}
        onCreate={onCreate}
        onClose={onClose}
      />
    </UiSettingsProvider>,
  );
  return { onCreate, onClose };
}

// Drive the click-to-edit Title editor: open it, type, and commit with Enter.
function typeTitle(value: string) {
  fireEvent.click(screen.getByRole("button", { name: "Edit Title" }));
  const input = screen.getByRole("textbox", { name: "Title" });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("VideoGameCreateModal", () => {
  it("defaults the System row to the box's system", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "System" })).toHaveTextContent(
      "SNES",
    );
  });

  it("disables Create until a title is entered", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    typeTitle("Super Mario World");
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("submits the game (with the picked system's id) and closes on success", async () => {
    const { onCreate, onClose } = renderModal();
    typeTitle("Super Mario World");

    // Swap the system to make sure the name maps back to its id.
    fireEvent.click(screen.getByRole("button", { name: "System" }));
    fireEvent.click(screen.getByRole("option", { name: "NES" }));

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      title: "Super Mario World",
      systemId: 1,
      customFieldValues: [],
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
      typeTitle("Super Mario World");
      fireEvent.click(
        screen.getByRole("button", { name: "Create And Add Another" }),
      );

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
      // The dialog is still open, the title cleared, the system back on its
      // default.
      expect(onClose).not.toHaveBeenCalled();
      expect(
        screen.getByRole("dialog", { name: "Create Video Game" }),
      ).toBeVisible();
      await waitFor(() =>
        expect(
          screen.queryByText("Super Mario World"),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("button", { name: "System" })).toHaveTextContent(
        "SNES",
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
