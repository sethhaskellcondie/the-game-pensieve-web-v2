import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listShowcases } from "@/lib/api";
import { fetchMe } from "@/lib/authBackend";
import { errorResponse } from "@/lib/bffError";
import { getSession } from "@/lib/session";
import {
  SHOWCASE_COOKIE_NAME,
  toSessionView,
  type ActiveShowcase,
} from "@/lib/sessionConfig";

// POST /api/showcase/select — select a public showcase to view (or clear the
// selection). Body: { slug: string | null }; null (or blank) clears back to the
// home state. The slug is validated against the live directory before the
// cookie is set, so junk/dark slugs never become a selection. Selecting a
// showcase also stops any active impersonation — the backend would let
// X-Showcase win anyway, but the UI must never be in both states at once.
// Returns the updated SessionView so the client can re-seed without a second
// round trip.

// How long a selection sticks. Long enough that an anonymous visitor's pick
// survives the visit; harmlessly re-validated against the directory on every
// request anyway.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  let slug: unknown;
  try {
    ({ slug } = (await request.json()) as { slug?: unknown });
  } catch {
    slug = undefined;
  }
  if (slug !== null && typeof slug !== "string") {
    return NextResponse.json(
      { status: "error", message: "slug must be a string or null." },
      { status: 400 },
    );
  }

  const requested = typeof slug === "string" ? slug.trim() : null;
  const cookieStore = await cookies();

  if (!requested) {
    cookieStore.delete(SHOWCASE_COOKIE_NAME);
    const session = await getSession();
    return NextResponse.json({
      status: "ok",
      data: toSessionView(session, null),
    });
  }

  // Validate against the live directory: only currently-visible showcases are
  // selectable. (A slug can exist but be dark while its owner isn't
  // PAID/ADMIN — indistinguishable from nonexistent, by design.)
  let active: ActiveShowcase;
  try {
    const directory = await listShowcases();
    const entry = directory.find((s) => s.slug === requested);
    if (!entry) {
      return NextResponse.json(
        { status: "error", message: "That showcase is not available." },
        { status: 404 },
      );
    }
    active = { slug: entry.slug, name: entry.name };
  } catch (error) {
    return errorResponse(error, "Couldn't verify that showcase.");
  }

  // Never render the impersonation and showcase banners at once: entering a
  // showcase view ends any active act-as, restoring the admin's own role the
  // same way the impersonate/stop route does.
  const session = await getSession();
  if (session.accessToken && session.impersonatingUserId != null) {
    session.impersonatingUserId = undefined;
    session.impersonatedEmail = undefined;
    const me = await fetchMe(session.accessToken);
    if (me) session.role = me.role;
    await session.save();
  }

  cookieStore.set(SHOWCASE_COOKIE_NAME, active.slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  return NextResponse.json({
    status: "ok",
    data: toSessionView(session, active),
  });
}
