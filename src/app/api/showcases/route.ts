import { NextResponse } from "next/server";
import { listShowcases } from "@/lib/api";
import { errorResponse } from "@/lib/bffError";

// GET /api/showcases — the public showcase directory ({slug, name} entries),
// for the client-side switcher. Anonymous-friendly: the backend endpoint needs
// no token and only lists showcases whose owner currently derives to
// PAID/ADMIN.
export async function GET() {
  try {
    const showcases = await listShowcases();
    return NextResponse.json({ status: "ok", data: showcases });
  } catch (error) {
    return errorResponse(error, "Couldn't load the showcase directory.");
  }
}
