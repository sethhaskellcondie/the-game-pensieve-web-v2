import { NextResponse } from "next/server";
import { loadSessionView } from "@/lib/session";

// GET /api/auth/session — the browser-safe session view { role, email }. Used
// by the client SessionProvider to re-hydrate (e.g. after a silent refresh).
export async function GET() {
  const view = await loadSessionView();
  return NextResponse.json({ status: "ok", data: view });
}
