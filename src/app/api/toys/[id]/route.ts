import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
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
    return errorResponse(error, "Failed to update toy");
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
    return errorResponse(error, "Failed to delete toy");
  }
}
