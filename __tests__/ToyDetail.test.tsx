import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CustomField, Toy } from "@/lib/api";
import ToyDetail from "@/components/toys/ToyDetail";
import { normalizeFieldValue } from "@/components/toys/toyFieldEditors";
import { ToastProvider } from "@/components/ToastProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

const definitions: CustomField[] = [
  { id: 1, name: "Line", type: "text", entityKey: "toy", order: 0, options: [] },
  {
    id: 2,
    name: "Series",
    type: "dropdown",
    entityKey: "toy",
    order: 1,
    options: [
      { id: 11, customFieldId: 2, name: "Breath of the Wild", isDefault: true, order: 0 },
      { id: 12, customFieldId: 2, name: "Ocarina of Time", isDefault: false, order: 1 },
    ],
  },
  { id: 3, name: "Articulated", type: "boolean", entityKey: "toy", order: 2, options: [] },
  { id: 4, name: "Quantity", type: "number", entityKey: "toy", order: 3, options: [] },
  {
    id: 5,
    name: "Condition",
    type: "radio_button",
    entityKey: "toy",
    order: 4,
    options: [
      { id: 21, customFieldId: 5, name: "Mint", isDefault: true, order: 0 },
      { id: 22, customFieldId: 5, name: "Good", isDefault: false, order: 1 },
    ],
  },
  {
    id: 6,
    name: "Build Progress",
    type: "progress_bar",
    entityKey: "toy",
    order: 5,
    options: [
      { id: 31, customFieldId: 6, name: "Purchased", isDefault: true, order: 0 },
      { id: 32, customFieldId: 6, name: "Opened", isDefault: false, order: 1 },
      { id: 33, customFieldId: 6, name: "Painted", isDefault: false, order: 2 },
      { id: 34, customFieldId: 6, name: "Finished", isDefault: false, order: 3 },
    ],
  },
];

const toy: Toy = {
  id: 7,
  key: "toy",
  name: "R2-D2",
  set: "Star Wars",
  customFieldValues: [
    { customFieldId: 1, customFieldName: "Line", customFieldType: "text", value: "Astromech" },
    { customFieldId: 2, customFieldName: "Series", customFieldType: "dropdown", value: "Breath of the Wild" },
    { customFieldId: 3, customFieldName: "Articulated", customFieldType: "boolean", value: "true" },
    { customFieldId: 4, customFieldName: "Quantity", customFieldType: "number", value: "2" },
    { customFieldId: 5, customFieldName: "Condition", customFieldType: "radio_button", value: "Mint" },
    { customFieldId: 6, customFieldName: "Build Progress", customFieldType: "progress_bar", value: "Painted" },
  ],
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
};

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ status: "ok", data: toy }),
    text: async () => "{}",
  } as unknown as Response;
}

const mockFetch = jest.fn();

function renderDetail(override?: Toy) {
  return render(
    <ToastProvider>
      <UiSettingsProvider initial={DEFAULT_UI_SETTINGS}>
        <ToyDetail toy={override ?? toy} definitions={definitions} />
      </UiSettingsProvider>
    </ToastProvider>,
  );
}

// The body of the most recent PUT to the toy, parsed.
function lastPutBody() {
  const put = [...mockFetch.mock.calls]
    .reverse()
    .find(([, init]) => init?.method === "PUT");
  return put ? JSON.parse(put[1].body) : null;
}

describe("ToyDetail", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(okResponse());
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("renders the toy name in the header, a back link, and a row per field", () => {
    renderDetail();

    expect(
      screen.getByRole("heading", { level: 1, name: "R2-D2" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/toys",
    );

    // Fixed Name + Set rows, plus the six custom-field rows.
    expect(screen.getByRole("button", { name: "Edit Name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Set" })).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.textContent === "6 custom fields"),
    ).toBeInTheDocument();

    // A sample of each value rendering.
    expect(screen.getByRole("button", { name: "Edit Line" })).toHaveTextContent(
      "Astromech",
    );
    expect(
      screen.getByRole("button", { name: "Articulated: Yes" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Mint" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("inline-edits the Name and PUTs the full toy", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Name" }));
    const input = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "C-3PO" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(lastPutBody()).toMatchObject({
      name: "C-3PO",
      set: "Star Wars",
      customFieldValues: toy.customFieldValues,
    });
    // Optimistic: the header reflects the new name.
    expect(
      screen.getByRole("heading", { level: 1, name: "C-3PO" }),
    ).toBeInTheDocument();
  });

  it("edits a text custom field, merging the value into customFieldValues", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Line" }));
    const input = screen.getByRole("textbox", { name: "Line" });
    fireEvent.change(input, { target: { value: "Protocol Droid" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const cf = lastPutBody().customFieldValues.find(
      (v: { customFieldId: number }) => v.customFieldId === 1,
    );
    expect(cf.value).toBe("Protocol Droid");
  });

  it("coerces and commits a number field", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Quantity" }));
    const input = screen.getByRole("spinbutton", { name: "Quantity" });
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const cf = lastPutBody().customFieldValues.find(
      (v: { customFieldId: number }) => v.customFieldId === 4,
    );
    expect(cf.value).toBe("5");
  });

  it("toggles a Yes/No field on click", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Articulated: Yes" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const cf = lastPutBody().customFieldValues.find(
      (v: { customFieldId: number }) => v.customFieldId === 3,
    );
    expect(cf.value).toBe("false");
  });

  it("selects a radio option", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("radio", { name: "Good" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const cf = lastPutBody().customFieldValues.find(
      (v: { customFieldId: number }) => v.customFieldId === 5,
    );
    expect(cf.value).toBe("Good");
  });

  it("changes a dropdown via the native select", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Series" }));
    const select = screen.getByRole("combobox", { name: "Series" });
    fireEvent.change(select, { target: { value: "Ocarina of Time" } });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const cf = lastPutBody().customFieldValues.find(
      (v: { customFieldId: number }) => v.customFieldId === 2,
    );
    expect(cf.value).toBe("Ocarina of Time");
  });

  it("sets a progress stage by clicking a step", async () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Finished" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const cf = lastPutBody().customFieldValues.find(
      (v: { customFieldId: number }) => v.customFieldId === 6,
    );
    expect(cf.value).toBe("Finished");
  });

  it("treats a blank Name as a no-op (no PUT, value unchanged)", () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Name" }));
    const input = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit Name" })).toHaveTextContent(
      "R2-D2",
    );
  });

  it("renders invalid stored values as empty", () => {
    const bad: Toy = {
      ...toy,
      customFieldValues: [
        { customFieldId: 4, customFieldName: "Quantity", customFieldType: "number", value: "not-a-number" },
        { customFieldId: 2, customFieldName: "Series", customFieldType: "dropdown", value: "Ghost Option" },
        { customFieldId: 5, customFieldName: "Condition", customFieldType: "radio_button", value: "Pristine" },
      ],
    };
    renderDetail(bad);

    // Non-numeric number + unknown dropdown option → the "Empty" placeholder.
    expect(screen.getByRole("button", { name: "Edit Quantity" })).toHaveTextContent(
      "Empty",
    );
    expect(screen.getByRole("button", { name: "Edit Series" })).toHaveTextContent(
      "Empty",
    );
    // An unknown radio option leaves nothing selected.
    expect(screen.getByRole("radio", { name: "Mint" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("radio", { name: "Good" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("rolls back the optimistic value when the PUT fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: "boom" }),
      text: async () => "{}",
    } as unknown as Response);
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Line" }));
    const input = screen.getByRole("textbox", { name: "Line" });
    fireEvent.change(input, { target: { value: "Protocol Droid" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // After the failed request, the original value is restored.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Edit Line" }),
      ).toHaveTextContent("Astromech"),
    );
  });
});

describe("normalizeFieldValue", () => {
  const seriesOptions = definitions[1].options; // dropdown options

  it("passes through valid values", () => {
    expect(normalizeFieldValue("text", "anything")).toBe("anything");
    expect(normalizeFieldValue("number", "5")).toBe("5");
    expect(normalizeFieldValue("number", "5.5")).toBe("5.5");
    expect(normalizeFieldValue("boolean", "true")).toBe("true");
    expect(normalizeFieldValue("boolean", "false")).toBe("false");
    expect(
      normalizeFieldValue("dropdown", "Ocarina of Time", seriesOptions),
    ).toBe("Ocarina of Time");
  });

  it("blanks missing and invalid values", () => {
    expect(normalizeFieldValue("text", undefined)).toBe("");
    expect(normalizeFieldValue("number", "")).toBe("");
    expect(normalizeFieldValue("number", "not-a-number")).toBe("");
    expect(normalizeFieldValue("boolean", "maybe")).toBe("");
    expect(normalizeFieldValue("dropdown", "Ghost Option", seriesOptions)).toBe(
      "",
    );
    expect(normalizeFieldValue("radio_button", "Pristine", [])).toBe("");
  });
});
