import { NextResponse } from "next/server";
import { updateVideoGameBox, type UpdateVideoGameBoxInput } from "@/lib/api";

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
