// Server-side detection of the backend's security posture. The backend runs in
// exactly one of two build profiles for the lifetime of a deployment — it never
// switches at runtime:
//
// - "secured": auth is enforced; protected routes require a Bearer token.
// - "unsecured" (the permit-all build): a personal, local, single-user
//   instance. No accounts, roles, or permissions apply; every request resolves
//   to the seeded default-showcase owner and the backend allows everything.
//
// The mode is telegraphed by GET /heartbeat's `secureMode` flag (see
// backend-documentation/openapi.yaml). Because it cannot change under a running
// backend, a definitive answer is cached for the life of this server process.
// An UNKNOWN answer (backend unreachable, or an older backend without the
// flag) fails closed to "secured" — the restrictive posture the app has always
// assumed — and is deliberately NOT cached, so a backend that comes up after
// the frontend gets re-probed on the next request.
//
// Server-only by convention (like src/lib/session.ts): it drives server
// renders and Route Handlers; Client Components read the resolved mode off the
// SessionView instead.

import { checkHeartbeat } from "./api";
import type { AuthMode } from "./sessionConfig";

let resolved: AuthMode | null = null;
let inFlight: Promise<AuthMode> | null = null;

export async function getAuthMode(): Promise<AuthMode> {
  if (resolved) return resolved;
  // Concurrent renders share one probe instead of stampeding the backend.
  if (!inFlight) {
    inFlight = probe().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function probe(): Promise<AuthMode> {
  try {
    const { secureMode } = await checkHeartbeat();
    if (secureMode === true) resolved = "secured";
    if (secureMode === false) resolved = "unsecured";
    if (resolved) return resolved;
  } catch {
    // Network failure — same as an unknown flag below.
  }
  return "secured";
}

// Test hook: the module-level cache would otherwise leak between tests.
export function resetAuthModeForTests(): void {
  resolved = null;
  inFlight = null;
}
