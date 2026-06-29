import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { searchBoardGameBoxes, type FilterRequestDto } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const { filters } = (await request.json()) as {
      filters: FilterRequestDto[];
    };
    const data = await searchBoardGameBoxes(filters);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to search board game boxes");
  }
}
