// Server-only access to the BFF session cookie (the encrypted store holding the
// backend access/refresh tokens). Imports `next/headers`, so it must only be
// used from Server Components and Route Handlers — middleware reads the session
// off the request/response directly (see src/middleware.ts) using sessionOptions
// from ./sessionConfig.

import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { resolveActiveShowcase } from "./serverShowcase";
import {
  sessionOptions,
  toSessionView,
  type ActiveShowcase,
  type SessionData,
  type SessionView,
} from "./sessionConfig";

export type { SessionData, SessionView };

// The live session bound to the current request's cookies. Mutate fields and
// call `.save()` to persist, or `.destroy()` to clear (only works in a Route
// Handler / Server Action — cookies cannot be written during an RSC render).
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

// The browser-safe view used to seed the client SessionProvider. Never exposes
// the tokens. Falls back to guest if the cookie is missing/garbled. The active
// showcase (the gp_showcase cookie, resolved against the directory for its
// display name) rides along so the banner and capability collapse are correct
// on first paint.
export async function loadSessionView(): Promise<SessionView> {
  let activeShowcase: ActiveShowcase | null = null;
  try {
    activeShowcase = await resolveActiveShowcase();
  } catch {
    activeShowcase = null;
  }
  try {
    const session = await getSession();
    return toSessionView(session, activeShowcase);
  } catch {
    return {
      role: "guest",
      email: null,
      isImpersonating: false,
      impersonatedEmail: null,
      accessUntil: null,
      activeShowcase,
    };
  }
}
