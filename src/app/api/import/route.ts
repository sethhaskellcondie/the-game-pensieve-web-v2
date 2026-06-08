import { NextResponse } from "next/server";
import { importData } from "@/lib/api";

export async function POST(request: Request) {
  try {
    // The client sends the parsed backup file as the request body; forward it
    // to the backend, which expects it wrapped as { data }.
    const data = await request.json();
    await importData(data);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import data";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
