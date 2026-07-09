import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { CustomField } from "@/lib/api";
import CustomFieldsManager from "@/components/custom-fields/CustomFieldsManager";
import { ToastProvider } from "@/components/ToastProvider";
import { MOBILE_MEDIA_QUERY } from "@/lib/useMediaQuery";

// Make useIsMobile() report a phone viewport for the duration of a test;
// returns the restore function (the jest.setup default is desktop/no-match).
function installMobileViewport() {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: query === MOBILE_MEDIA_QUERY,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

const boardFields: CustomField[] = [
  { id: 1, name: "Designers", type: "text", entityKey: "boardGame", order: 0, options: [] },
  {
    id: 2,
    name: "Theme",
    type: "dropdown",
    entityKey: "boardGame",
    order: 1,
    options: [
      { id: 9, customFieldId: 2, name: "Fantasy", isDefault: true, order: 0 },
    ],
  },
];

const videoFields: CustomField[] = [
  { id: 3, name: "Platform", type: "dropdown", entityKey: "videoGame", order: 0, options: [] },
];

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const mockFetch = jest.fn();

function routedFetch(url: string, init?: RequestInit) {
  const method = init?.method ?? "GET";
  if (method === "GET" && url.includes("/entity/boardGame")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: boardFields }));
  }
  if (method === "GET" && url.includes("/entity/videoGame")) {
    return Promise.resolve(jsonResponse({ status: "ok", data: videoFields }));
  }
  if (method === "DELETE") {
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }
  return Promise.resolve(jsonResponse({ status: "ok", data: {} }));
}

function renderManager() {
  return render(
    <ToastProvider>
      <CustomFieldsManager />
    </ToastProvider>,
  );
}

describe("CustomFieldsManager", () => {
  beforeEach(() => {
    mockFetch.mockImplementation(routedFetch);
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("loads and renders the scoped fields with a count", async () => {
    renderManager();
    expect(
      await screen.findByText("Designers"),
    ).toBeInTheDocument();
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Board Game" }),
    ).toBeInTheDocument();
  });

  it("refetches when the scoped entity changes", async () => {
    renderManager();
    await screen.findByText("Designers");

    fireEvent.click(screen.getByRole("button", { name: /board game/i }));
    fireEvent.click(screen.getByRole("option", { name: "Video Game" }));

    expect(
      await screen.findByText("Platform"),
    ).toBeInTheDocument();
    expect(
      mockFetch.mock.calls.some(([url]) =>
        String(url).includes("/entity/videoGame"),
      ),
    ).toBe(true);
  });

  it("deletes a field via the row delete button", async () => {
    renderManager();
    await screen.findByText("Designers");

    fireEvent.click(screen.getByRole("button", { name: "Delete Designers" }));

    // The trash opens an "Are you sure?" confirmation; the DELETE only fires
    // once its Delete is confirmed.
    const menu = screen.getByRole("menu", { name: "Delete Designers?" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => {
      expect(
        mockFetch.mock.calls.some(
          ([url, init]) =>
            String(url).includes("/custom-fields/1") &&
            (init as RequestInit)?.method === "DELETE",
        ),
      ).toBe(true);
    });
    expect(
      screen.queryByText("Designers"),
    ).not.toBeInTheDocument();
  });

  it("moves a field down with its reorder button and persists both orders", async () => {
    renderManager();
    await screen.findByText("Designers");

    fireEvent.click(
      screen.getByRole("button", { name: "Move Designers down" }),
    );

    // The rows swap immediately (optimistic), Theme now first.
    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByText("Theme")).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText("Designers")).toBeInTheDocument();

    // Both changed rows persist their new order via PUT.
    await waitFor(() => {
      expect(
        mockFetch.mock.calls.filter(
          ([, init]) => (init as RequestInit)?.method === "PUT",
        ),
      ).toHaveLength(2);
    });
    const putBody = (id: number) => {
      const call = mockFetch.mock.calls.find(
        ([url, init]) =>
          String(url).includes(`/custom-fields/${id}`) &&
          (init as RequestInit)?.method === "PUT",
      );
      return JSON.parse(String((call?.[1] as RequestInit)?.body));
    };
    expect(putBody(1)).toEqual({ name: "Designers", order: 1 });
    expect(putBody(2)).toEqual({ name: "Theme", order: 0 });
  });

  it("moves a field up with its reorder button", async () => {
    renderManager();
    await screen.findByText("Designers");

    fireEvent.click(screen.getByRole("button", { name: "Move Theme up" }));

    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByText("Theme")).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText("Designers")).toBeInTheDocument();
  });

  it("disables the reorder buttons at the list ends", async () => {
    renderManager();
    await screen.findByText("Designers");

    expect(
      screen.getByRole("button", { name: "Move Designers up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Theme down" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Designers down" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move Theme up" })).toBeEnabled();
  });

  it("renames a field inline via the name cell", async () => {
    renderManager();
    await screen.findByText("Designers");

    // Click the name to enter edit mode, change it, and commit with Enter.
    fireEvent.click(screen.getByRole("button", { name: "Designers" }));
    const input = screen.getByLabelText("Name for Designers");
    fireEvent.change(input, { target: { value: "Designer" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(
        mockFetch.mock.calls.some(
          ([url, init]) =>
            String(url).includes("/custom-fields/1") &&
            (init as RequestInit)?.method === "PUT" &&
            JSON.parse(String((init as RequestInit)?.body)).name === "Designer",
        ),
      ).toBe(true);
    });
    // The new name is shown and the input is gone.
    expect(screen.getByRole("button", { name: "Designer" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Name for Designers")).not.toBeInTheDocument();
  });

  it("cancels an inline rename on Escape without calling the API", async () => {
    renderManager();
    await screen.findByText("Designers");

    fireEvent.click(screen.getByRole("button", { name: "Designers" }));
    const input = screen.getByLabelText("Name for Designers");
    fireEvent.change(input, { target: { value: "Discarded" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Designers" })).toBeInTheDocument();
    expect(
      mockFetch.mock.calls.some(
        ([, init]) => (init as RequestInit)?.method === "PUT",
      ),
    ).toBe(false);
  });

  it("opens the edit modal when a field's options cell is clicked", async () => {
    renderManager();
    await screen.findByText("Theme");

    fireEvent.click(screen.getByRole("button", { name: "Edit Theme" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Update Custom Field" }),
    ).toBeInTheDocument();
    // The clicked field's data populates the form.
    expect(within(dialog).getByLabelText("Field name")).toHaveValue("Theme");
  });

  describe("on a phone viewport", () => {
    let restoreViewport: () => void;
    beforeEach(() => {
      restoreViewport = installMobileViewport();
    });
    afterEach(() => {
      restoreViewport();
    });

    it("renders one interactive card per field instead of the table", async () => {
      renderManager();
      await screen.findByText("Designers");

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      const list = screen.getByRole("list", { name: "Custom fields" });
      const cards = within(list).getAllByRole("listitem");
      expect(cards).toHaveLength(2);

      // Each card keeps the write controls (custom fields have no detail
      // page, so reorder/delete/edit/rename must all live here). The name is
      // the tap-to-rename trigger, same as the desktop name cell.
      const card = cards[0];
      expect(
        within(card).getByRole("button", { name: "Designers" }),
      ).toBeInTheDocument();
      expect(
        within(card).getByRole("button", { name: "Move Designers up" }),
      ).toBeDisabled();
      expect(
        within(card).getByRole("button", { name: "Move Designers down" }),
      ).toBeEnabled();
      expect(
        within(card).getByRole("button", { name: "Delete Designers" }),
      ).toBeInTheDocument();
      expect(
        within(card).getByRole("button", { name: "Edit Designers" }),
      ).toBeInTheDocument();
      // An option-less field (Designers is text) shows just its type badge —
      // no "N/A" filler on cards. The option-bearing Theme still lists its
      // options.
      expect(within(card).queryByText("N/A")).not.toBeInTheDocument();
      expect(within(cards[1]).getByText("Fantasy")).toBeInTheDocument();
    });

    it("reorders with the card buttons and persists the swap", async () => {
      renderManager();
      await screen.findByText("Designers");

      fireEvent.click(
        screen.getByRole("button", { name: "Move Designers down" }),
      );

      const list = screen.getByRole("list", { name: "Custom fields" });
      const cards = within(list).getAllByRole("listitem");
      expect(within(cards[0]).getByText("Theme")).toBeInTheDocument();
      expect(within(cards[1]).getByText("Designers")).toBeInTheDocument();
      await waitFor(() => {
        expect(
          mockFetch.mock.calls.filter(
            ([, init]) => (init as RequestInit)?.method === "PUT",
          ),
        ).toHaveLength(2);
      });
    });

    it("renames a field inline from its card", async () => {
      renderManager();
      await screen.findByText("Designers");

      fireEvent.click(screen.getByRole("button", { name: "Designers" }));
      const input = screen.getByLabelText("Name for Designers");
      fireEvent.change(input, { target: { value: "Designer" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(
          mockFetch.mock.calls.some(
            ([url, init]) =>
              String(url).includes("/custom-fields/1") &&
              (init as RequestInit)?.method === "PUT" &&
              JSON.parse(String((init as RequestInit)?.body)).name ===
                "Designer",
          ),
        ).toBe(true);
      });
      expect(
        screen.getByRole("button", { name: "Designer" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText("Name for Designers"),
      ).not.toBeInTheDocument();
    });

    it("deletes from a card through the confirmation menu", async () => {
      renderManager();
      await screen.findByText("Designers");

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Designers" }),
      );
      const menu = screen.getByRole("menu", { name: "Delete Designers?" });
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }));

      await waitFor(() => {
        expect(
          mockFetch.mock.calls.some(
            ([url, init]) =>
              String(url).includes("/custom-fields/1") &&
              (init as RequestInit)?.method === "DELETE",
          ),
        ).toBe(true);
      });
      expect(screen.queryByText("Designers")).not.toBeInTheDocument();
    });

    it("opens the edit modal from a card's type/options body", async () => {
      renderManager();
      await screen.findByText("Theme");

      fireEvent.click(screen.getByRole("button", { name: "Edit Theme" }));

      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog).getByRole("heading", { name: "Update Custom Field" }),
      ).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Field name")).toHaveValue("Theme");
    });
  });

  it("opens the create modal from the New button", async () => {
    renderManager();
    await screen.findByText("Designers");

    fireEvent.click(screen.getByRole("button", { name: "New" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Create Custom Field" }),
    ).toBeInTheDocument();
  });
});
