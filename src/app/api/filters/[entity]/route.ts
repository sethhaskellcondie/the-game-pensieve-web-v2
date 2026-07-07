import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
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
    return errorResponse(error, "Failed to load filters");
  }
}
