import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { seedSampleData } from "@/lib/api";

export async function POST() {
  try {
    await seedSampleData();
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error, "Failed to seed sample data");
  }
}
