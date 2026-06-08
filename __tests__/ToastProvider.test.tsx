import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  ToastProvider,
  useToast,
  type SnackbarOptions,
  type ToastOptions,
} from "@/components/ToastProvider";

// A tiny harness that exposes showToast through a button so tests can trigger
// toasts the same way real components do (via the hook).
function Trigger({ label, options }: { label: string; options: ToastOptions }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast(options)}>
      {label}
    </button>
  );
}

// Same idea, but for the persistent snackbar API.
function SnackbarTrigger({
  label,
  options,
}: {
  label: string;
  options: SnackbarOptions;
}) {
  const { showSnackbar } = useToast();
  return (
    <button type="button" onClick={() => showSnackbar(options)}>
      {label}
    </button>
  );
}

function renderWithProvider(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("ToastProvider", () => {
  it("renders its children", () => {
    renderWithProvider(<p>child content</p>);
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("shows a toast with a status role when requested", () => {
    renderWithProvider(
      <Trigger label="go" options={{ message: "Saved!", variant: "success" }} />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "go" }));

    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Saved!");
  });

  it("stacks multiple toasts", () => {
    renderWithProvider(
      <>
        <Trigger label="first" options={{ message: "One" }} />
        <Trigger label="second" options={{ message: "Two" }} />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "first" }));
    fireEvent.click(screen.getByRole("button", { name: "second" }));

    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
  });

  it("dismisses a toast when its close button is clicked", () => {
    renderWithProvider(
      <Trigger label="go" options={{ message: "Dismiss me", duration: 0 }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "go" }));
    expect(screen.getByText("Dismiss me")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Dismiss me")).not.toBeInTheDocument();
  });

  it("auto-dismisses after the given duration", () => {
    jest.useFakeTimers();
    try {
      renderWithProvider(
        <Trigger label="go" options={{ message: "Temporary", duration: 1000 }} />,
      );

      fireEvent.click(screen.getByRole("button", { name: "go" }));
      expect(screen.getByText("Temporary")).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(screen.queryByText("Temporary")).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps a snackbar up indefinitely until dismissed", () => {
    jest.useFakeTimers();
    try {
      renderWithProvider(
        <SnackbarTrigger label="go" options={{ message: "Needs action" }} />,
      );

      fireEvent.click(screen.getByRole("button", { name: "go" }));

      // Well past any toast auto-dismiss window — the snackbar is still there.
      act(() => {
        jest.advanceTimersByTime(60000);
      });
      expect(screen.getByText("Needs action")).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: "Dismiss notification" }),
      );
      expect(screen.queryByText("Needs action")).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps a toast up when duration is 0", () => {
    jest.useFakeTimers();
    try {
      renderWithProvider(
        <Trigger label="go" options={{ message: "Sticky", duration: 0 }} />,
      );

      fireEvent.click(screen.getByRole("button", { name: "go" }));
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      expect(screen.getByText("Sticky")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
