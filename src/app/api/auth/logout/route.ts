import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// POST /api/auth/logout — clears the session cookie, returning the user to guest.
export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ status: "ok" });
}
