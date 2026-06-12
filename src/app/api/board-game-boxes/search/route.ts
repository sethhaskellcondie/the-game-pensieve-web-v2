import { NextResponse } from "next/server";
import { searchBoardGameBoxes, type FilterRequestDto } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const { filters } = (await request.json()) as {
      filters: FilterRequestDto[];
    };
    const data = await searchBoardGameBoxes(filters);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to search board game boxes";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
