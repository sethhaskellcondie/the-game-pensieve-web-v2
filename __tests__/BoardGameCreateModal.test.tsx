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

// Drive a text editor: open it (Title is already open on mount, so its Edit
// button is absent), type, and commit with Enter.
function typeField(name: string, value: string) {
  const editButton = screen.queryByRole("button", { name: `Edit ${name}` });
  if (editButton) fireEvent.click(editButton);
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

  it("focuses the open Title field on mount so it can be typed at once", () => {
    renderModal();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveFocus();
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
          valueOptionId: null,
        },
      ],
    });
  });

  it("closes on Escape outside mass-input mode", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // This dialog only ever supplies the single game a box needs, so it opts out
  // of the global mass-input rapid-entry loop: even with massInputMode on it
  // stays a plain single-create dialog (button "Create", create closes,
  // Escape closes) rather than repeating.
  describe("ignores mass-input mode (never repeats)", () => {
    it("still labels the button Create, not Create And Add Another", () => {
      renderModal({ massInputMode: true });
      expect(
        screen.getByRole("button", { name: "Create" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Create And Add Another" }),
      ).not.toBeInTheDocument();
    });

    it("closes after a successful create instead of staying open", async () => {
      const { onCreate, onClose } = renderModal({ massInputMode: true });
      typeField("Title", "Settlers of Catan");
      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("still closes on Escape", () => {
      const { onClose } = renderModal({ massInputMode: true });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
