import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
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
    return errorResponse(error, "Failed to update custom field");
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
    return errorResponse(error, "Failed to delete custom field");
  }
}
