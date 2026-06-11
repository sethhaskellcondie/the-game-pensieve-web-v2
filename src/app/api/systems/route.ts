import { NextResponse } from "next/server";
import { createSystem, searchSystems, type CreateSystemInput } from "@/lib/api";

export async function GET() {
  try {
    const data = await searchSystems();
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load systems";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateSystemInput;
    const data = await createSystem(input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create system";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
