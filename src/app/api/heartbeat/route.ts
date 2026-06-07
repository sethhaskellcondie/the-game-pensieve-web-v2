import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkHeartbeat } from "@/lib/api";

// Server-side doorway for the browser's "Run Heartbeat" button. The button can't
// call the backend directly because API_BASE_URL is server-only, so this Route
// Handler proxies the health check and reports a small status payload. Any failure
// (thrown error or non-OK backend response) is reported as offline rather than
// surfacing a 500.
export async function GET(request: NextRequest) {
  const debug = request.nextUrl.searchParams.get("debug") === "1";
  try {
    const ok = await checkHeartbeat({ debug });
    return NextResponse.json(
      { status: ok ? "online" : "offline" },
      { status: ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json({ status: "offline" }, { status: 503 });
  }
}
