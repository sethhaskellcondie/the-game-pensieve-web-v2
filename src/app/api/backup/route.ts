import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { backup } from "@/lib/api";

export async function POST() {
  try {
    const data = await backup();
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to back up data");
  }
}
