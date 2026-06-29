import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { createSystem, searchSystems, type CreateSystemInput } from "@/lib/api";

export async function GET() {
  try {
    const data = await searchSystems();
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to load systems");
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateSystemInput;
    const data = await createSystem(input);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to create system");
  }
}
