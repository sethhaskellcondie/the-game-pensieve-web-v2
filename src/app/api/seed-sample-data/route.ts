import { NextResponse } from "next/server";
import { seedSampleData } from "@/lib/api";

export async function POST() {
  try {
    await seedSampleData();
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to seed sample data";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
