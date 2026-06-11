import { parseVideoGamesViewParam } from "@/lib/videoGamesView";

// The page itself is an async Server Component (covered by E2E), so the
// ?view= resolution it builds on is unit tested here: an explicit param wins,
// anything else returns null so the page falls back to the user's
// videoGamesDefaultView setting.
describe("parseVideoGamesViewParam", () => {
  it("accepts the two explicit views", () => {
    expect(parseVideoGamesViewParam("list")).toBe("list");
    expect(parseVideoGamesViewParam("shelf")).toBe("shelf");
  });

  it("returns null when the param is absent, so the setting decides", () => {
    expect(parseVideoGamesViewParam(undefined)).toBeNull();
  });

  it("returns null for unrecognized or repeated params", () => {
    expect(parseVideoGamesViewParam("carousel")).toBeNull();
    expect(parseVideoGamesViewParam("")).toBeNull();
    expect(parseVideoGamesViewParam(["list", "shelf"])).toBeNull();
  });
});
