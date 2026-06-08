import { NextResponse } from "next/server";
import { backup } from "@/lib/api";

export async function POST() {
  try {
    const data = await backup();
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to back up data";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
