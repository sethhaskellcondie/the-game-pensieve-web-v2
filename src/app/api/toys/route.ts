import { NextResponse } from "next/server";
import { searchToys } from "@/lib/api";

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
