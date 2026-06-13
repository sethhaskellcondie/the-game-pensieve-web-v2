import {
  updateSystem,
  writableCustomFieldValues,
  type CustomFieldValue,
} from "@/lib/api";

// A stored value as the read API returns it. The backend can return
// placeholder entries for enum fields with no selection yet (valueOptionId
// null); writes must omit those or the whole update is rejected with a 400.
const cfv = (over: Partial<CustomFieldValue>): CustomFieldValue => ({
  customFieldId: 1,
  customFieldName: "Field",
  customFieldType: "text",
  value: "x",
  valueOptionId: null,
  ...over,
});

const unsetDropdown = cfv({
  customFieldId: 10,
  customFieldType: "dropdown",
  value: null as unknown as string,
});
const setDropdown = cfv({
  customFieldId: 11,
  customFieldType: "dropdown",
  value: "Sega",
  valueOptionId: 7,
});
const text = cfv({ customFieldId: 12, customFieldType: "text", value: "hi" });
const bool = cfv({
  customFieldId: 13,
  customFieldType: "boolean",
  value: "false",
});

describe("writableCustomFieldValues", () => {
  it("drops enum entries with no selected option and keeps everything else", () => {
    const result = writableCustomFieldValues([
      unsetDropdown,
      setDropdown,
      text,
      bool,
      cfv({
        customFieldId: 14,
        customFieldType: "radio_button",
        value: null as unknown as string,
      }),
      cfv({
        customFieldId: 15,
        customFieldType: "progress_bar",
        value: null as unknown as string,
      }),
    ]);
    expect(result).toEqual([setDropdown, text, bool]);
  });

  it("keeps non-enum entries even when their value is empty", () => {
    const cleared = cfv({ customFieldId: 16, value: "" });
    expect(writableCustomFieldValues([cleared])).toEqual([cleared]);
  });
});

describe("update payload sanitization", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    process.env.API_BASE_URL = "http://backend.test/v1";
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {}, errors: null }),
    });
  });

  afterEach(() => {
    delete process.env.API_BASE_URL;
    mockFetch.mockReset();
  });

  it("omits unset enum placeholders from a system update", async () => {
    await updateSystem(9, {
      name: "Genesis",
      generation: 4,
      handheld: false,
      customFieldValues: [unsetDropdown, setDropdown, text],
    });

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string) as {
      system: { customFieldValues: CustomFieldValue[] };
    };
    expect(body.system.customFieldValues).toEqual([setDropdown, text]);
  });
});
