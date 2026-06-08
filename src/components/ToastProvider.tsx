"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./Toast.module.css";

export type ToastVariant = "success" | "error" | "info";

export type ToastOptions = {
  message: string;
  // Drives the icon and accent color. Defaults to "info".
  variant?: ToastVariant;
  // Milliseconds before the toast auto-dismisses. Pass 0 to keep it up until
  // the user dismisses it manually. Defaults to DEFAULT_DURATION.
  duration?: number;
};

// A snackbar is a toast that never auto-dismisses, so it has no `duration`.
export type SnackbarOptions = Omit<ToastOptions, "duration">;

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  // Shows an auto-dismissing toast and returns its id (so callers can dismiss
  // it early). Honors `duration`, defaulting to DEFAULT_DURATION.
  showToast: (options: ToastOptions) => number;
  // Shows a persistent snackbar that stays up until the user dismisses it (or a
  // caller passes its id to dismissToast). Returns its id.
  showSnackbar: (options: SnackbarOptions) => number;
  dismissToast: (id: number) => void;
};

// Safe no-op default so components using the hook don't crash when rendered
// without a provider (e.g. an isolated unit test that doesn't assert toasts).
const ToastContext = createContext<ToastContextValue>({
  showToast: () => -1,
  showSnackbar: () => -1,
  dismissToast: () => {},
});

const DEFAULT_DURATION = 4000;

// App-wide toast host. Provides showToast/dismissToast through context and
// renders the fixed viewport that stacks active toasts. Auto-dismiss timers are
// tracked per-toast so manual dismissal also clears the pending timer.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    ({ message, variant = "info", duration = DEFAULT_DURATION }: ToastOptions) => {
      const id = (nextId.current += 1);
      setToasts((current) => [...current, { id, message, variant }]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismissToast(id), duration),
        );
      }
      return id;
    },
    [dismissToast],
  );

  // A snackbar is just a toast with no auto-dismiss timer (duration 0).
  const showSnackbar = useCallback(
    (options: SnackbarOptions) => showToast({ ...options, duration: 0 }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, showSnackbar, dismissToast }}>
      {children}
      <div className={styles.viewport} aria-label="Notifications">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${styles[toast.variant]}`}
            role="status"
          >
            <span className={styles.icon}>{ICONS[toast.variant]}</span>
            <span className={styles.message}>{toast.message}</span>
            <button
              type="button"
              className={styles.close}
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const ICONS: Record<ToastVariant, ReactNode> = {
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.5" />
    </svg>
  ),
};
