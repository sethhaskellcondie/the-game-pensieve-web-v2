// Resolution of the video games page's ?view= search param. Client-safe (no
// server-only imports) and free of React, so the page's view choice is unit
// testable even though the page itself is an async Server Component.

import type { VideoGamesView } from "./uiSettings.types";

// Reads an explicit view out of the raw search param, or null when the param
// is absent/unrecognized (in which case the caller falls back to the user's
// Default Video Games View setting). Only exact "list"/"shelf" values count;
// repeated params (string[]) are ignored rather than guessed at.
export function parseVideoGamesViewParam(
  param: string | string[] | undefined,
): VideoGamesView | null {
  return param === "list" || param === "shelf" ? param : null;
}
