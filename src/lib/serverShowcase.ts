// Server-only resolution of the active public showcase (the `gp_showcase`
// cookie) against the backend's showcase directory. Imports `next/headers`, so
// — like src/lib/session.ts — it must only be used from Server Components and
// Route Handlers.
//
// Resolution answers two needs with one directory lookup:
//   - the showcase's display NAME, so the banner/switcher render on first paint
//     without a client fetch;
//   - VALIDITY, so a stale slug (owner lapsed, grant revoked, junk cookie) is
//     marked `stale` — the X-Showcase resolver then stops attaching the header
//     (that render falls back to the home state instead of cascading backend
//     404s) and the client clears the cookie and tells the user.
//
// Wrapped in React's cache() so the layout, the page, and every showcase-scoped
// api.ts call within one server render share a single directory fetch.

import { cache } from "react";
import { cookies } from "next/headers";
import { listShowcases } from "./api";
import { SHOWCASE_COOKIE_NAME, type ActiveShowcase } from "./sessionConfig";

// The raw selected slug, or null when no showcase is selected (the home state).
// Never throws — a missing/unreadable cookie store just reads as no selection.
export async function readShowcaseSlug(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get(SHOWCASE_COOKIE_NAME)?.value?.trim();
    return slug || null;
  } catch {
    return null;
  }
}

// The active showcase resolved against the directory (memoized per request).
// Returns null when nothing is selected. When the directory can't be reached
// at all, the slug gets the benefit of the doubt (name falls back to the slug,
// not stale): if the backend is truly down the data calls fail regardless, and
// a transient directory hiccup must not bounce a valid selection.
export const resolveActiveShowcase = cache(
  async (): Promise<ActiveShowcase | null> => {
    const slug = await readShowcaseSlug();
    if (!slug) return null;

    try {
      const directory = await listShowcases();
      const entry = directory.find((s) => s.slug === slug);
      if (entry) return { slug: entry.slug, name: entry.name };
      return { slug, name: slug, stale: true };
    } catch {
      return { slug, name: slug };
    }
  },
);
