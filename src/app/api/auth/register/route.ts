import { NextResponse } from "next/server";
import { registerBackend, AuthError } from "@/lib/authBackend";

// POST /api/auth/register — proxies the public backend register endpoint. The
// backend auto-grants a 30-day trial (new accounts start Paid). A duplicate
// email comes back as a 400 with the backend's message, which we pass through.
export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json()) as {
      email?: string;
      password?: string;
    };
    if (!email || !password) {
      return NextResponse.json(
        { status: "error", message: "Email and password are required." },
        { status: 400 },
      );
    }

    const user = await registerBackend(email, password);
    return NextResponse.json({ status: "ok", data: user }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: "error", message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { status: "error", message: "Registration failed." },
      { status: 502 },
    );
  }
}
