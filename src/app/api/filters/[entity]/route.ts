import { NextResponse } from "next/server";
import { getFilterSpec, type EntityKey } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const { entity } = await params;
  try {
    const data = await getFilterSpec(entity as EntityKey);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load filters";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
