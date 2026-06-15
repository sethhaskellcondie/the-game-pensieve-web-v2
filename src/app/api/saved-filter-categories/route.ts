import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  loadSavedFilterCategories,
  updateSavedFilterCategories,
} from "@/lib/savedFilterCategories";
import { normalizeCategories } from "@/lib/savedFilterCategories.types";

// Returns the current saved-filter categories. loadSavedFilterCategories never
// throws (it falls back to just the Uncategorized row), so this always answers
// with a usable, ordered list.
export async function GET() {
  const categories = await loadSavedFilterCategories();
  return NextResponse.json(categories);
}

// Replaces the whole category list. The body is the ordered array; order is
// re-derived from position, and the list is normalized (Uncategorized
// guaranteed, ids de-duped) before it's persisted.
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    await updateSavedFilterCategories(normalizeCategories(body));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
