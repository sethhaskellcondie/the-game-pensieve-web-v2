import { NextResponse } from "next/server";
import {
  deleteBoardGameBox,
  updateBoardGameBox,
  type UpdateBoardGameBoxInput,
} from "@/lib/api";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const input = (await request.json()) as UpdateBoardGameBoxInput;
    const data = await updateBoardGameBox(Number(id), input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update board game box";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteBoardGameBox(Number(id));
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete board game box";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
