import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/bffError";
import { listAdminUsers } from "@/lib/api";

// GET /api/admin/users — proxies the admin-only user list. The backend enforces
// the ADMIN role (403 for non-admins, 401 for anonymous); errorResponse passes
// those statuses through so the client can react.
export async function GET() {
  try {
    const data = await listAdminUsers();
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    return errorResponse(error, "Failed to list users");
  }
}
