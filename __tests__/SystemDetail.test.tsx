import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CustomField, System } from "@/lib/api";
import SystemDetail from "@/components/systems/SystemDetail";
import { ToastProvider } from "@/components/ToastProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

const definitions: CustomField[] = [
  { id: 1, name: "Storage", type: "text", entityKey: "system", order: 0, options: [] },
  {
    id: 2,
    name: "Region",
    type: "dropdown",
    entityKey: "system",
    order: 1,
    options: [
      { id: 11, customFieldId: 2, name: "NTSC", isDefault: true, order: 0 },
      { id: 12, customFieldId: 2, name: "PAL", isDefault: false, order: 1 },
    ],
  },
  { id: 3, name: "Modded", type: "boolean", entityKey: "system", order: 2, options: [] },
];

const system: System = {
  id: 7,
  key: "system",
  name: "Game Boy",
  generation: 4,
  handheld: true,
  customFieldValues: [
    { customFieldId: 1, customFieldName: "Storage", customFieldType: "text", value: "Cartridge" },
    { customFieldId: 2, customFieldName: "Region", customFieldType: "dropdown", value: "NTSC" },
    { customFieldId: 3, customFieldName: "Modded", customFieldType: "boolean", value: "false" },
  ],
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
};

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ status: "ok", data: system }),
    text: async () => "{}",
  } as unknown as Response;
}

const mockFetch = jest.fn();

function renderDetail(override?: System) {
  return render(
    <ToastProvider>
      <UiSettingsProvider initial={DEFAULT_UI_SETTINGS}>
        <SystemDetail system={override ?? system} definitions={definitions} />
      </UiSettingsProvider>
    </ToastProvider>,
  );
}

// The body of the most recent PUT to the system, parsed.
function lastPutBody() {
  const put = [...mockFetch.mock.calls]
    .reverse()
    .find(([, init]) => init?.method === "PUT");
  return put ? JSON.parse(put[1].body) : null;
}

describe("SystemDetail", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(okResponse());
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("renders the system name in the header, a back link, and a row per field", () => {
    renderDetail();

    expect(
      screen.getByRole("heading", { level: 1, name: "SYSTEM" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Game Boy · Generation 4")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/systems",
    );

    // Fixed Name + Generation + Handheld rows, plus the three custom-field rows.
    expect(screen.getByRole("button", { name: "Edit Name" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Generation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Handheld: Yes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.textContent === "3 custom fields"),
    ).toBeInTheDocument();

    // The three built-in rows are tagged as "Standard" fields.
    expect(screen.getAllByText("Standard")).toHaveLength(3);

    // A sample of each value rendering.
    expect(
      screen.getByRole("button", { name: "Edit Storage" }),
    ).toHaveTextContent("Cartridge");
    expect(
      screen.getByRole("button", { name: "Modded: No" }),
    ).toBeInTheDocument();
  });

  it("inline-edits the Name and PUTs the full system", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Name" }));
    const input = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "Game Boy Color" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(lastPutBody()).toMatchObject({
      name: "Game Boy Color",
      generation: 4,
      handheld: true,
      customFieldValues: system.customFieldValues,
    });
    // Optimistic: the header tagline reflects the new name.
    expect(
      screen.getByText("Game Boy Color · Generation 4"),
    ).toBeInTheDocument();
  });

  it("edits the Generation and PUTs the numeric value", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Generation" }));
    const input = screen.getByRole("spinbutton", { name: "Generation" });
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(lastPutBody()).toMatchObject({
      name: "Game Boy",
      generation: 5,
      handheld: true,
    });
    expect(screen.getByText("Game Boy · Generation 5")).toBeInTheDocument();
  });

  it("treats a cleared Generation as a no-op (no PUT, value unchanged)", () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Generation" }));
    const input = screen.getByRole("spinbutton", { name: "Generation" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Edit Generation" }),
    ).toHaveTextContent("4");
  });

  it("toggles Handheld on click and PUTs the flipped boolean", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Handheld: Yes" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(lastPutBody()).toMatchObject({
      name: "Game Boy",
      generation: 4,
      handheld: false,
    });
  });

  it("treats a blank Name as a no-op (no PUT, value unchanged)", () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Name" }));
    const input = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit Name" })).toHaveTextContent(
      "Game Boy",
    );
  });

  it("edits a text custom field, merging the value into customFieldValues", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Storage" }));
    const input = screen.getByRole("textbox", { name: "Storage" });
    fireEvent.change(input, { target: { value: "Disc" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const cf = lastPutBody().customFieldValues.find(
      (v: { customFieldId: number }) => v.customFieldId === 1,
    );
    expect(cf.value).toBe("Disc");
  });

  it("changes a dropdown via the custom listbox", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Region" }));
    fireEvent.click(screen.getByRole("option", { name: "PAL" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const cf = lastPutBody().customFieldValues.find(
      (v: { customFieldId: number }) => v.customFieldId === 2,
    );
    expect(cf.value).toBe("PAL");
  });

  it("rolls back the optimistic value when the PUT fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: "boom" }),
      text: async () => "{}",
    } as unknown as Response);
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Generation" }));
    const input = screen.getByRole("spinbutton", { name: "Generation" });
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // After the failed request, the original value is restored.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Edit Generation" }),
      ).toHaveTextContent("4"),
    );
    expect(screen.getByText("Game Boy · Generation 4")).toBeInTheDocument();
  });
});
