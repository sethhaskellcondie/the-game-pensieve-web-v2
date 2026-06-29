import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
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
    return errorResponse(error, "Failed to update board game box");
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
    return errorResponse(error, "Failed to delete board game box");
  }
}
