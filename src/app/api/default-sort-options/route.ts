import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  loadDefaultSortOptions,
  updateDefaultSortOptions,
} from "@/lib/defaultSortOptions";
import { asDefaultSortOptions } from "@/lib/defaultSortOptions.types";

// Returns the current default sort options. loadDefaultSortOptions never
// throws (it falls back to no defaults), so this always answers with a usable
// options object.
export async function GET() {
  const options = await loadDefaultSortOptions();
  return NextResponse.json(options);
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    await updateDefaultSortOptions(asDefaultSortOptions(body));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
