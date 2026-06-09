import { NextResponse } from "next/server";
import {
  deleteCustomField,
  updateCustomField,
  type UpdateCustomFieldInput,
} from "@/lib/api";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const input = (await request.json()) as UpdateCustomFieldInput;
    const data = await updateCustomField(Number(id), input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update custom field";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteCustomField(Number(id));
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete custom field";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
