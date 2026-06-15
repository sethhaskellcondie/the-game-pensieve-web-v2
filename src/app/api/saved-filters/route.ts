import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loadSavedFilters, updateSavedFilters } from "@/lib/savedFilters";
import { normalizeFilters } from "@/lib/savedFilters.types";

// Returns the current saved filters. loadSavedFilters never throws (it falls
// back to an empty list), so this always answers with a usable array.
export async function GET() {
  const filters = await loadSavedFilters();
  return NextResponse.json(filters);
}

// Replaces the whole saved-filter list. The body is the full array; it's
// normalized (malformed records dropped, ids de-duped) before it's persisted.
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    await updateSavedFilters(normalizeFilters(body));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
