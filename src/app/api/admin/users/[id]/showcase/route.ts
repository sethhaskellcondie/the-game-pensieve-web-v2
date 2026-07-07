import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { ApiError, setUserShowcase } from "@/lib/api";

// POST /api/admin/users/:id/showcase — grant, edit, or clear a user's public
// showcase. The body is { slug, name }; a null/blank slug clears the grant.
// The backend enforces ADMIN (401/403), the slug format and uniqueness (400),
// and the user id (404). Validation 400s are passed through with the backend's
// message intact (slug taken / invalid format) so the admin sees the real
// reason; other failures go through the shared errorResponse mapping.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { slug, name } = (await request.json()) as {
      slug?: string | null;
      name?: string | null;
    };
    const data = await setUserShowcase(Number(id), {
      slug: slug ?? null,
      name: name ?? null,
    });
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      // Strip the generic "Backend request failed: …(path):" prefix so the
      // admin-facing message is the backend's validation detail verbatim.
      const message = error.message.replace(
        /^Backend request failed: \d+ [^(]*\([^)]*\):\s*/,
        "",
      );
      return NextResponse.json(
        { status: "error", message },
        { status: 400 },
      );
    }
    return errorResponse(error, "Failed to update the user's showcase");
  }
}
