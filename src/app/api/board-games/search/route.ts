import { NextResponse } from "next/server";
import { searchBoardGames, type FilterRequestDto } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const { filters } = (await request.json()) as {
      filters: FilterRequestDto[];
    };
    const data = await searchBoardGames(filters);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to search board games";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
