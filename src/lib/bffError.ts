// Shared error mapping for the data BFF route handlers. The backend's auth and
// entitlement failures must reach the browser with their real status so the
// client can react: 401 (not authenticated / anonymous write) → send to login,
// 402 (lapsed tried to filter) and 403 (lapsed tried to write) → upgrade prompt.
// Everything else is a generic upstream failure (502).

import { NextResponse } from "next/server";
import { ApiError } from "./api";

const PASSTHROUGH_STATUSES = new Set([401, 402, 403]);

export function errorResponse(
  error: unknown,
  fallbackMessage: string,
): NextResponse {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const status =
    error instanceof ApiError && PASSTHROUGH_STATUSES.has(error.status)
      ? error.status
      : 502;
  return NextResponse.json({ status: "error", message }, { status });
}
