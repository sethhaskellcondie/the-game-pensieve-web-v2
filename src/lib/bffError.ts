// Shared error mapping for the data BFF route handlers. The backend's auth and
// entitlement failures must reach the browser with their real status so the
// client can react: 401 (not authenticated / anonymous write) → send to login,
// 402 (lapsed tried to filter) and 403 (lapsed tried to write) → upgrade prompt.
// Everything else is a generic upstream failure (502).
//
// One 404 is special: the backend's tenant filter answers an unknown or
// no-longer-visible X-Showcase slug with a 404 envelope ("No public showcase
// exists…"). That means the viewer's selected showcase went away mid-visit
// (owner lapsed, grant revoked) — we clear the gp_showcase cookie right here so
// the very next request falls back to the home state, and surface a
// distinguishable `code` so the client can toast and reload instead of showing
// a generic failure.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ApiError } from "./api";
import { SHOWCASE_COOKIE_NAME } from "./sessionConfig";

const PASSTHROUGH_STATUSES = new Set([401, 402, 403]);

// The marker the client (bffFetch) looks for to detect a vanished showcase.
export const SHOWCASE_UNAVAILABLE_CODE = "SHOWCASE_UNAVAILABLE";

// The backend's tenant-filter message for an unknown/not-visible slug. Matched
// as a substring because ApiError prefixes it with request context.
const SHOWCASE_404_MARKER = "No public showcase exists";

function isShowcaseGone(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    error.message.includes(SHOWCASE_404_MARKER)
  );
}

export async function errorResponse(
  error: unknown,
  fallbackMessage: string,
): Promise<NextResponse> {
  if (isShowcaseGone(error)) {
    try {
      const cookieStore = await cookies();
      cookieStore.delete(SHOWCASE_COOKIE_NAME);
    } catch {
      // Even if the cookie can't be cleared here, the client clears it via
      // /api/showcase/select on seeing the code below.
    }
    return NextResponse.json(
      {
        status: "error",
        code: SHOWCASE_UNAVAILABLE_CODE,
        message: "That showcase is no longer available.",
      },
      { status: 404 },
    );
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  const status =
    error instanceof ApiError && PASSTHROUGH_STATUSES.has(error.status)
      ? error.status
      : 502;
  return NextResponse.json({ status: "error", message }, { status });
}
