import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { createBoardGameBox, type CreateBoardGameBoxInput } from "@/lib/api";

// Creates a board game box (listing goes through ./search instead). The box's
// game rides along as boardGameId (existing) or boardGame (created inline).
export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateBoardGameBoxInput;
    const data = await createBoardGameBox(input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to create board game box");
  }
}
