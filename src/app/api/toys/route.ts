import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { createToy, searchToys, type CreateToyInput } from "@/lib/api";

export async function GET() {
  try {
    const data = await searchToys();
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to load toys");
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateToyInput;
    const data = await createToy(input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to create toy");
  }
}
