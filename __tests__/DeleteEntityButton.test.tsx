import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useRouter } from "next/navigation";
import DeleteEntityButton from "@/components/detail/DeleteEntityButton";
import { ToastProvider } from "@/components/ToastProvider";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));
const mockPush = jest.fn();

const mockFetch = jest.fn();

function renderButton() {
  return render(
    <ToastProvider>
      <DeleteEntityButton
        endpoint="/api/toys/1"
        label="Delete Toy"
        successMessage="Toy deleted."
        errorNoun="toy"
        backHref="/toys"
      />
    </ToastProvider>,
  );
}

function jsonResponse(body: unknown, init: { ok: boolean }) {
  return {
    ok: init.ok,
    json: async () => body,
  } as Response;
}

describe("DeleteEntityButton", () => {
  beforeEach(() => {
    mockPush.mockReset();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(jsonResponse({ status: "ok" }, { ok: true }));
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("renders the labeled delete button without an open confirmation", () => {
    renderButton();

    expect(
      screen.getByRole("button", { name: "Delete Toy" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the Are-you-sure menu on click without deleting", () => {
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Delete Toy" }));

    const menu = screen.getByRole("menu", { name: "Delete Toy?" });
    expect(within(menu).getByText("Are you sure?")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("dismisses the menu on Escape without deleting", () => {
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Delete Toy" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("dismisses the menu on an outside click without deleting", () => {
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Delete Toy" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("deletes, toasts, and navigates to the list on confirm", async () => {
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Delete Toy" }));
    fireEvent.click(
      within(screen.getByRole("menu")).getByRole("menuitem", { name: "Delete" }),
    );

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/toys"));

    const del = mockFetch.mock.calls.find(
      ([, init]) => init?.method === "DELETE",
    );
    expect(del).toBeDefined();
    expect(String(del![0])).toBe("/api/toys/1");
    expect(screen.getByText("Toy deleted.")).toBeInTheDocument();
  });

  it("surfaces the backend error and does not navigate when the delete fails", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ status: "error", message: "boom" }, { ok: false }),
    );
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Delete Toy" }));
    fireEvent.click(
      within(screen.getByRole("menu")).getByRole("menuitem", { name: "Delete" }),
    );

    await screen.findByText(/Couldn't delete the toy: boom/);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
