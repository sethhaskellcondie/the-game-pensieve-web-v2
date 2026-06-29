// Server-only wiring that teaches the shared data client (src/lib/api.ts) how to
// read the per-request bearer token from the BFF session cookie. Kept separate
// from api.ts so api.ts stays free of `next/headers`/iron-session and remains
// safe to import from Client Components. Installed once at server startup from
// src/instrumentation.ts (and never bundled into the browser).

import { setTokenResolver } from "./api";
import { getSession } from "./session";

export function installServerTokenResolver(): void {
  setTokenResolver(async () => {
    try {
      // cookies() is request-scoped (AsyncLocalStorage), so reading it at
      // call-time inside a server component render or route handler yields the
      // current request's session even though this resolver was installed once.
      const session = await getSession();
      return session.accessToken ?? process.env.API_TOKEN ?? null;
    } catch {
      return process.env.API_TOKEN ?? null;
    }
  });
}
