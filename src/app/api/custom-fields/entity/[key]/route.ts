import { NextResponse } from "next/server";
import { listCustomFieldsByEntity, type EntityKey } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  try {
    const data = await listCustomFieldsByEntity(key as EntityKey);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load custom fields";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
