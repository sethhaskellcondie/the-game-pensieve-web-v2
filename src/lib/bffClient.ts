// Client-side helper for calling the BFF (`/api/*`) with centralized handling of
// the auth/capability statuses the backend can return: 401 (not authenticated),
// 402 (a non-FILTER-capable role tried to filter — in practice LAPSED), and 403
// (the caller's role lacks the capability for the action: WRITE, IMPORT, BACKUP,
// or admin). Components keep their existing `res.ok` handling — bffFetch just
// fires the registered handlers as a side effect so the app can redirect to
// login or surface a capability-appropriate prompt instead of failing silently.
//
// The handlers are registered once by SessionProvider (which has access to the
// router + upgrade prompt). Until then they are no-ops, so bffFetch is always
// safe to call.

// The statuses that mean "the caller's role can't do this". 403 is NOT implicitly
// "lapsed" — it's any capability denial; the handler decides what it means by
// re-reading the authoritative role.
export type CapabilityDeniedStatus = 402 | 403;

type BffHandlers = {
  // A request needed auth but the session was missing/expired.
  onUnauthorized?: () => void;
  // The caller's role lacked the capability for the action (402 filter / 403
  // write|import|backup|admin). The handler resolves what to show.
  onCapabilityDenied?: (
    status: CapabilityDeniedStatus,
    message: string,
  ) => void;
};

let handlers: BffHandlers = {};

export function registerBffHandlers(next: BffHandlers): void {
  handlers = next;
}

// Reads the BFF error envelope ({ status: "error", message }) without disturbing
// the caller's ability to read the body again.
async function readMessage(res: Response): Promise<string> {
  try {
    const body = (await res.clone().json()) as { message?: string };
    return body.message ?? "";
  } catch {
    return "";
  }
}

// Drop-in for `fetch` against the BFF. Returns the Response unchanged (callers
// handle `res.ok`/`res.json()` as before); the only added behavior is firing the
// auth/entitlement handlers when the backend reports one of those statuses.
export async function bffFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);

  if (res.status === 401) {
    handlers.onUnauthorized?.();
  } else if (res.status === 402 || res.status === 403) {
    const message = await readMessage(res);
    handlers.onCapabilityDenied?.(res.status, message);
  }

  return res;
}
