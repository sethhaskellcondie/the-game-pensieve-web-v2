import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { searchVideoGameBoxes, type FilterRequestDto } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const { filters } = (await request.json()) as {
      filters: FilterRequestDto[];
    };
    const data = await searchVideoGameBoxes(filters);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to search video game boxes");
  }
}
