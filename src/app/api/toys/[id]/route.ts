import { NextResponse } from "next/server";
import { deleteToy, updateToy, type UpdateToyInput } from "@/lib/api";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const input = (await request.json()) as UpdateToyInput;
    const data = await updateToy(Number(id), input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update toy";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteToy(Number(id));
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete toy";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
