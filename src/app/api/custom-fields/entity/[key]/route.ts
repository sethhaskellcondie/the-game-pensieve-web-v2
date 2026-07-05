import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { listCustomFieldsByEntityOrEmpty, type EntityKey } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  try {
    // The OrEmpty variant degrades a 401/403 to "no custom fields": under the
    // backend's `secured` profile /custom_fields requires a token, but this
    // read feeds table columns and filter options for pages that anonymous
    // visitors legitimately browse (the default showcase and public
    // showcases). Rendering without custom columns beats failing the whole
    // page load.
    const data = await listCustomFieldsByEntityOrEmpty(key as EntityKey);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to load custom fields");
  }
}
