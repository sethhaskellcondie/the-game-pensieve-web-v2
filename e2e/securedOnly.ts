import { test, type APIRequestContext } from "@playwright/test";

// The backend runs in exactly one mode per deployment. Specs that assert
// SECURED-only behavior — guest tier UI, guest→login redirects, /pricing,
// admin gating — call this first (in a beforeEach or at the top of the test):
// against the permit-all build the anonymous caller owns the collection, so
// none of that behavior exists. e2e/unsecured.spec.ts probes the same flag in
// the opposite direction and carries the coverage for that mode.
export async function skipUnlessSecured(
  request: APIRequestContext,
): Promise<void> {
  const heartbeat = await request.get("/api/heartbeat");
  const { secureMode } = (await heartbeat.json()) as {
    secureMode?: boolean | null;
  };
  test.skip(
    secureMode === false,
    "secured-only behavior: the permit-all backend has no guests or accounts",
  );
}
