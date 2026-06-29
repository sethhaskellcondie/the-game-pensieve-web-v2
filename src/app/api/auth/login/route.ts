import { NextResponse } from "next/server";
import { loginBackend, fetchRole, AuthError } from "@/lib/authBackend";
import { getSession } from "@/lib/session";

// POST /api/auth/login — exchanges credentials for backend tokens, stores them
// in the httpOnly session cookie (the browser never sees the JWT), reads the
// account's authoritative role, and returns only the browser-safe view
// { email, role }.
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

    const tokens = await loginBackend(email, password);
    // Default to a safe, fully-capable role if the role probe is transiently
    // unavailable; the runtime 402/403 handling still catches a genuine lapse.
    const role = (await fetchRole(tokens.accessToken)) ?? "paid";

    const session = await getSession();
    session.accessToken = tokens.accessToken;
    session.refreshToken = tokens.refreshToken;
    session.accessTokenExpiresAt = Date.now() + tokens.expiresInMs;
    session.email = email;
    session.role = role;
    await session.save();

    return NextResponse.json({ status: "ok", data: { email, role } });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: "error", message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { status: "error", message: "Login failed." },
      { status: 502 },
    );
  }
}
