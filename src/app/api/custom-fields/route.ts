import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { createCustomField, type CreateCustomFieldInput } from "@/lib/api";

export async function POST(request: Request) {
  try {
    // The client sends the CreateCustomFieldInput as the request body; forward
    // it to the backend, which expects it wrapped as { custom_field }.
    const input = (await request.json()) as CreateCustomFieldInput;
    const data = await createCustomField(input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to create custom field");
  }
}
