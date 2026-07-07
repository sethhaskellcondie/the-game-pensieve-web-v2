import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { importFromFile } from "@/lib/api";

export async function POST() {
  try {
    await importFromFile();
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error, "Failed to import from backup");
  }
}
