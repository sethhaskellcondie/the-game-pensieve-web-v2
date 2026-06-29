import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import {
  deleteVideoGameBox,
  updateVideoGameBox,
  type UpdateVideoGameBoxInput,
} from "@/lib/api";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const input = (await request.json()) as UpdateVideoGameBoxInput;
    const data = await updateVideoGameBox(Number(id), input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to update video game box");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteVideoGameBox(Number(id));
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error, "Failed to delete video game box");
  }
}
