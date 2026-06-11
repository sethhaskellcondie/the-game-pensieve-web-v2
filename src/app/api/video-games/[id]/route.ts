import { NextResponse } from "next/server";
import { updateVideoGame, type UpdateVideoGameInput } from "@/lib/api";

// Video games have no DELETE endpoint — they are removed through their video
// game boxes — so this route only handles updates.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const input = (await request.json()) as UpdateVideoGameInput;
    const data = await updateVideoGame(Number(id), input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update video game";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
