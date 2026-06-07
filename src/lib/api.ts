// Single source of truth for talking to The Game Pensieve backend.
// Routes and the response envelope are documented in backend-documentation/openapi.yaml.

// Resolves the API base URL (including the /v1 prefix). In development, we fall
// back to the local backend; in production API_BASE_URL MUST be set so a
// misconfigured deployment fails loudly instead of silently calling localhost.
function getBaseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:8080/v1";
  }
  throw new Error(
    "API_BASE_URL is not set. Define it in the environment before building for production.",
  );
}

// The backend wraps every response as { data, errors }.
type ApiResponse<T> = { data: T; errors: string[] | null };

// Fetches a path relative to the API base (e.g. "/toys") and unwraps the
// { data, errors } envelope, throwing on transport or API-level errors.
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    // Read live data from the backend rather than a cached copy. (Next.js 16
    // does not cache fetch by default, but we state the intent explicitly.)
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Backend request failed: ${res.status} ${res.statusText} (${path})`,
    );
  }

  const body = (await res.json()) as ApiResponse<T>;
  if (body.errors && body.errors.length > 0) {
    throw new Error(
      `Backend returned errors for ${path}: ${body.errors.join(", ")}`,
    );
  }
  return body.data;
}

// Pings the backend health-check endpoint and reports whether it responded OK.
// Unlike the other routes, /heartbeat returns text/plain ("thump thump") rather
// than the { data, errors } envelope, so it bypasses apiGet.
export async function checkHeartbeat(): Promise<boolean> {
  const res = await fetch(`${getBaseUrl()}/heartbeat`, { cache: "no-store" });
  return res.ok;
}
