import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { unsealData } from "iron-session";
import { appOrigin } from "@/lib/appOrigin";
import { getSession } from "@/lib/session";
import { endSessionUrl } from "@/lib/oidc";
import {
  ID_TOKEN_COOKIE_NAME,
  sessionOptions,
  type IdTokenCookie,
} from "@/lib/sessionConfig";

// POST /api/auth/logout — clears the local session cookie (and the id_token
// cookie) and, when an id_token is present, returns an RP-initiated `logoutUrl`
// so the client can redirect the browser to Keycloak's end-session endpoint
// (killing the SSO session, not just the local cookie). If there is no id_token
// (or the env isn't configured), `logoutUrl` is null and the client just
// hard-navigates home.
export async function POST(request: Request) {
  const session = await getSession();
  session.destroy();

  const cookieStore = await cookies();

  // The id_token lives in its own sealed cookie (see ID_TOKEN_COOKIE_NAME) —
  // read it for the logout hint, then clear it.
  let idToken: string | undefined;
  const rawId = cookieStore.get(ID_TOKEN_COOKIE_NAME)?.value;
  if (rawId) {
    try {
      const data = await unsealData<IdTokenCookie>(rawId, {
        password: sessionOptions.password as string,
      });
      idToken = data?.idToken;
    } catch {
      // Corrupt/expired seal — nothing to hint with; just clear it below.
    }
    cookieStore.delete(ID_TOKEN_COOKIE_NAME);
  }

  let logoutUrl: string | null = null;
  if (idToken) {
    try {
      logoutUrl = endSessionUrl({
        idToken,
        // Public origin — the realm's post.logout.redirect.uris are registered
        // against it, not against the container's bind address.
        postLogoutRedirectUri: appOrigin(request),
      });
    } catch {
      // OIDC env not configured (e.g. an unsecured/personal deploy) — the local
      // session is already destroyed, so a plain client-side home nav suffices.
      logoutUrl = null;
    }
  }

  return NextResponse.json({ status: "ok", data: { logoutUrl } });
}
