import { NextResponse } from "next/server";
import { importFromFile } from "@/lib/api";

export async function POST() {
  try {
    await importFromFile();
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import from backup";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
