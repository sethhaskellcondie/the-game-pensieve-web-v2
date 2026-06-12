import { NextResponse } from "next/server";
import { updateBoardGame, type UpdateBoardGameInput } from "@/lib/api";

// Board games have no DELETE endpoint — they are removed through their board
// game boxes — so this route only handles updates.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const input = (await request.json()) as UpdateBoardGameInput;
    const data = await updateBoardGame(Number(id), input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update board game";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
