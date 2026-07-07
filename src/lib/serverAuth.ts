// Server-only wiring that teaches the shared data client (src/lib/api.ts) how to
// read the per-request bearer token from the BFF session cookie. Kept separate
// from api.ts so api.ts stays free of `next/headers`/iron-session and remains
// safe to import from Client Components. Installed once at server startup from
// src/instrumentation.ts (and never bundled into the browser).

import { setActAsResolver, setShowcaseResolver, setTokenResolver } from "./api";
import { getSession } from "./session";
import { resolveActiveShowcase } from "./serverShowcase";

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

// Teaches the shared data client to attach the `X-Act-As-Owner` header from the
// current request's session whenever an admin is impersonating a user. Like the
// token resolver, it reads the request-scoped session at call-time, so a single
// install covers every server component render and route handler. No id → no
// header → a normal, non-impersonating request.
export function installServerActAsResolver(): void {
  setActAsResolver(async () => {
    try {
      const session = await getSession();
      return session.impersonatingUserId ?? null;
    } catch {
      return null;
    }
  });
}

// Teaches the shared data client to attach the `X-Showcase` header from the
// `gp_showcase` cookie on showcase-scoped (collection data) calls. Resolution
// goes through resolveActiveShowcase — validated against the directory — so a
// stale slug yields no header (the render falls back to the home state) rather
// than turning every collection call into a backend 404. Like the other
// resolvers, it reads request-scoped state at call-time, so a single install
// covers every server component render and route handler.
export function installServerShowcaseResolver(): void {
  setShowcaseResolver(async () => {
    try {
      const active = await resolveActiveShowcase();
      return active && !active.stale ? active.slug : null;
    } catch {
      return null;
    }
  });
}
