import { NextResponse } from "next/server";
import { searchSystems, type FilterRequestDto } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const { filters } = (await request.json()) as {
      filters: FilterRequestDto[];
    };
    const data = await searchSystems(filters);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to search systems";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
