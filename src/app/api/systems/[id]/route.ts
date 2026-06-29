import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import {
  deleteSystem,
  updateSystem,
  type UpdateSystemInput,
} from "@/lib/api";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const input = (await request.json()) as UpdateSystemInput;
    const data = await updateSystem(Number(id), input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to update system");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteSystem(Number(id));
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error, "Failed to delete system");
  }
}
