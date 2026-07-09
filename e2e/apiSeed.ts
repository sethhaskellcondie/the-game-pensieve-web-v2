import { expect, type Page } from "@playwright/test";

// Creates real entities for the shared e2e account through the BFF proxy —
// `page.request` carries the authenticated session cookie from auth.setup.ts.
//
// Why real rows: detail pages ([id]/page.tsx) fetch server-side, so page.route
// can't stub them. Pre-roles these specs visited hardcoded id 1 from the old
// shared collection; now each seeds its own row and navigates to the real id.
// Names are salted so parallel browsers on the shared account never collide.

async function post<T>(page: Page, path: string, data: unknown): Promise<T> {
  const res = await page.request.post(`/api${path}`, { data });
  expect(res.ok(), `POST /api${path} → ${res.status()}`).toBe(true);
  return (await res.json()).data as T;
}

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

export function seedToy(page: Page): Promise<{ id: number }> {
  return post(page, "/toys", {
    name: `E2E Toy ${uniq()}`,
    set: "E2E",
    customFieldValues: [],
  });
}

export function seedSystem(page: Page): Promise<{ id: number }> {
  return post(page, "/systems", {
    name: `E2E System ${uniq()}`,
    generation: 1,
    handheld: false,
    customFieldValues: [],
  });
}

// A physical box holding one brand-new game (games are born inside boxes).
export async function seedVideoGameBox(
  page: Page,
): Promise<{ id: number; videoGames: { id: number }[] }> {
  const system = await seedSystem(page);
  return post(page, "/video-game-boxes", {
    title: `E2E Box ${uniq()}`,
    systemId: system.id,
    existingVideoGameIds: [],
    newVideoGames: [
      { title: `E2E Game ${uniq()}`, systemId: system.id, customFieldValues: [] },
    ],
    isPhysical: true,
    customFieldValues: [],
  });
}

// A stand-alone box with one brand-new board game linked inline.
export function seedBoardGameBox(
  page: Page,
): Promise<{ id: number; boardGame: { id: number } }> {
  return post(page, "/board-game-boxes", {
    title: `E2E BG Box ${uniq()}`,
    isExpansion: false,
    isStandAlone: true,
    baseSetId: null,
    boardGameId: null,
    boardGame: { title: `E2E Board Game ${uniq()}`, customFieldValues: [] },
    customFieldValues: [],
  });
}
