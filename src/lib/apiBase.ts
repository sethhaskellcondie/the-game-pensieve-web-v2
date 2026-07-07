// The backend's base URL, shared by the authed data client (src/lib/api.ts) and
// the public auth client (src/lib/authBackend.ts). Kept in its own module — free
// of `next/headers` — so it can be imported from contexts where that API is not
// available (e.g. middleware running on the Node runtime).

export function getBaseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:8080/v1";
  }
  throw new Error(
    "API_BASE_URL is not set. Define it in the environment before building for production.",
  );
}
