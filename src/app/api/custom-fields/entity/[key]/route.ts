import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
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
    return errorResponse(error, "Failed to load custom fields");
  }
}
