import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { createVideoGameBox, type CreateVideoGameBoxInput } from "@/lib/api";

// Creates a video game box (listing goes through ./search instead). Any games
// for the new box ride along in existingVideoGameIds / newVideoGames.
export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateVideoGameBoxInput;
    const data = await createVideoGameBox(input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to create video game box");
  }
}
