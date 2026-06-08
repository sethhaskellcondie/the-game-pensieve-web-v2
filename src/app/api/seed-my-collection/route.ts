import { NextResponse } from "next/server";
import { seedMyCollection } from "@/lib/api";

export async function POST() {
  try {
    await seedMyCollection();
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to seed Seth's data";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
