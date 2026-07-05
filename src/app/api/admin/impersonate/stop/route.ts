import { NextResponse } from "next/server";
import { fetchMe } from "@/lib/authBackend";
import { getSession } from "@/lib/session";
import { toSessionView } from "@/lib/sessionConfig";

// POST /api/admin/impersonate/stop — stop acting as a user. Gated on an active
// impersonation (we can't key off role here — while impersonating it's the
// target's). "Stop" means drop the act-as header (clear the id) and re-read
// GET /v1/auth/me with no header to restore the admin's own role.
export async function POST() {
  const session = await getSession();
  if (!session.accessToken || session.impersonatingUserId == null) {
    return NextResponse.json(
      { status: "error", message: "Not currently impersonating." },
      { status: 400 },
    );
  }

  session.impersonatingUserId = undefined;
  session.impersonatedEmail = undefined;

  // Restore the admin's own effective role. On a transient probe failure we keep
  // the stale role; the next token refresh (now header-free) corrects it.
  const me = await fetchMe(session.accessToken);
  if (me) session.role = me.role;
  await session.save();

  return NextResponse.json({ status: "ok", data: toSessionView(session) });
}
