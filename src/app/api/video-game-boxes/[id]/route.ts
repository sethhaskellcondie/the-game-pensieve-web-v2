import { NextResponse } from "next/server";
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
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update video game box";
    return NextResponse.json({ status: "error", message }, { status: 502 });
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
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete video game box";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
