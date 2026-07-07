import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { seedMyCollection } from "@/lib/api";

export async function POST() {
  try {
    await seedMyCollection();
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error, "Failed to seed Seth's data");
  }
}
