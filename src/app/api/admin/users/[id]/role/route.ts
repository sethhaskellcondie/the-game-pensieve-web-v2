import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { setUserRoleOverride, type BackendRole } from "@/lib/api";

// POST /api/admin/users/:id/role — set or clear a user's role override. The body
// is { roleOverride } where roleOverride is one of GUEST/TRIAL/PAID/LAPSED/ADMIN
// or null to clear the pin. The backend enforces ADMIN (403/401), validates the
// role value (400), and the user id (404); errorResponse forwards those statuses.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { roleOverride } = (await request.json()) as {
      roleOverride?: BackendRole | null;
    };
    const data = await setUserRoleOverride(Number(id), roleOverride ?? null);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to update user role");
  }
}
