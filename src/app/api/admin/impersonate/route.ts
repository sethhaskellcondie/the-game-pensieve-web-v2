import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchMe } from "@/lib/authBackend";
import { getSession } from "@/lib/session";
import { SHOWCASE_COOKIE_NAME, toSessionView } from "@/lib/sessionConfig";

// POST /api/admin/impersonate — start acting as a user. Body: { userId }.
//
// Gated on a REAL admin (session.role === "admin" and not already impersonating;
// while impersonating, role is the target's, so this naturally blocks re-entry).
// Impersonation is driven entirely by the X-Act-As-Owner header — there's no
// backend start endpoint — so "start" means: record the target id (the resolver
// attaches the header on every backend call from here on) and confirm with
// GET /v1/auth/me that the backend actually honored it.
//
// The backend is lenient: an admin acting as a non-existent user gets a no-op
// (impersonating: null) rather than an error. We validate against that — if the
// confirmation shows no impersonation, we clear the id and fail.
export async function POST(request: Request) {
  let userId: unknown;
  try {
    ({ userId } = (await request.json()) as { userId?: unknown });
  } catch {
    userId = undefined;
  }
  if (typeof userId !== "number" || !Number.isInteger(userId)) {
    return NextResponse.json(
      { status: "error", message: "A numeric userId is required." },
      { status: 400 },
    );
  }

  const session = await getSession();
  if (
    !session.accessToken ||
    session.role !== "admin" ||
    session.impersonatingUserId != null
  ) {
    return NextResponse.json(
      { status: "error", message: "Only an admin may impersonate a user." },
      { status: 403 },
    );
  }

  // Record the target so the act-as header is attached, then confirm the backend
  // honored it. fetchMe also passes the header explicitly (it doesn't go through
  // the shared client's resolver), so this works on the very first call.
  session.impersonatingUserId = userId;
  const me = await fetchMe(session.accessToken, userId);

  if (!me || !me.impersonatedEmail) {
    // Either the probe failed transiently, or the backend no-op'd the header
    // (e.g. the target doesn't exist). /me is the source of truth — back out.
    session.impersonatingUserId = undefined;
    session.impersonatedEmail = undefined;
    await session.save();
    return NextResponse.json(
      { status: "error", message: "Couldn't act as that user." },
      { status: 502 },
    );
  }

  // Store the EFFECTIVE (target's) role so the capability matrix mirrors what
  // the backend will allow, plus the target's email for the banner. accessUntil
  // stays the admin's own window (the backend reports the primary identity's).
  session.role = me.role;
  session.impersonatedEmail = me.impersonatedEmail;
  session.accessUntil = me.accessUntil ?? undefined;
  await session.save();

  // Impersonation and a showcase view are mutually exclusive states (the
  // showcase header would win over act-as on the backend and confuse the UI) —
  // starting act-as drops any selected showcase.
  const cookieStore = await cookies();
  cookieStore.delete(SHOWCASE_COOKIE_NAME);

  return NextResponse.json({ status: "ok", data: toSessionView(session) });
}
