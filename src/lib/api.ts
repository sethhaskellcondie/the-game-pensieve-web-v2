// Single source of truth for talking to The Game Pensieve backend.
// Routes and the response envelope are documented in backend-documentation/openapi.yaml.

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
type ApiResponse<T> = {
  data: T; errors: string[] | null
};

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
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
export async function checkHeartbeat(
  { debug = false }: { debug?: boolean } = {},
): Promise<boolean> {
  const url = `${getBaseUrl()}/heartbeat`;
  const res = await fetch(url, { cache: "no-store" });

  if (debug) {
    const body = await res.clone().text();
    //if debug mode is on, then display the response in the next.js console
    console.log(
      `[heartbeat] GET ${url} → ${res.status} ${res.statusText}: ${body}`,
    );
  }

  return res.ok;
}
