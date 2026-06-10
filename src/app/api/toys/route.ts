import { NextResponse } from "next/server";
import { createToy, searchToys, type CreateToyInput } from "@/lib/api";

export async function GET() {
  try {
    const data = await searchToys();
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load toys";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateToyInput;
    const data = await createToy(input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create toy";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
