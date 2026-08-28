import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkHeartbeat } from "@/lib/api";

// Server-side doorway for the browser's "Run Heartbeat" button. The button can't
// call the backend directly because API_BASE_URL is server-only, so this Route
// Handler proxies the health check and reports a small status payload, including
// the backend's `secureMode` flag and the release `version` it reports for itself
// (both null when unknown). Any failure (thrown error or non-OK backend response)
// is reported as offline rather than surfacing a 500.
export async function GET(request: NextRequest) {
  const debug = request.nextUrl.searchParams.get("debug") === "1";
  try {
    const { ok, secureMode, version } = await checkHeartbeat({ debug });
    return NextResponse.json(
      { status: ok ? "online" : "offline", secureMode, version },
      { status: ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      { status: "offline", secureMode: null, version: null },
      { status: 503 },
    );
  }
}
