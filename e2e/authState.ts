import path from "path";

// Where auth.setup.ts saves the authenticated browser state, and where
// authenticated specs load it from via `test.use({ storageState: AUTH_STATE })`.
// Lives under e2e/.auth/ (gitignored) — it holds a live session cookie.
export const AUTH_STATE = path.join(__dirname, ".auth", "user.json");
