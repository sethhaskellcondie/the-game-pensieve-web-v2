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

// Pulls the backend's error detail out of a non-OK response so callers (and,
// ultimately, the browser) get the real cause instead of just the status line.
// Reads the { data, errors } envelope when present, falls back to raw body
// text, and never throws (a failure to parse just yields null).
async function readErrorDetail(res: Response): Promise<string | null> {
  try {
    const body = (await res.clone().json()) as { errors?: unknown };
    const { errors } = body;
    if (Array.isArray(errors)) {
      return errors.length > 0 ? errors.join(", ") : null;
    }
    if (errors && typeof errors === "object") {
      return JSON.stringify(errors);
    }
    if (typeof errors === "string") {
      return errors || null;
    }
    return null;
  } catch {
    try {
      const text = (await res.text()).trim();
      return text || null;
    } catch {
      return null;
    }
  }
}

// Builds the thrown-error message for a failed request, appending the backend's
// error detail when it provided one.
async function failureMessage(res: Response, path: string): Promise<string> {
  const detail = await readErrorDetail(res);
  const base = `Backend request failed: ${res.status} ${res.statusText} (${path})`;
  return detail ? `${base}: ${detail}` : base;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await failureMessage(res, path));
  }

  const body = (await res.json()) as ApiResponse<T>;
  if (body.errors && body.errors.length > 0) {
    throw new Error(
      `Backend returned errors for ${path}: ${body.errors.join(", ")}`,
    );
  }
  return body.data;
}

// Like apiGet, but treats a 404 as "not found" and returns null instead of
// throwing. Other non-OK responses and envelope errors still throw.
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    cache: "no-store",
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(await failureMessage(res, path));
  }

  const body = (await res.json()) as ApiResponse<T>;
  if (body.errors && body.errors.length > 0) {
    throw new Error(
      `Backend returned errors for ${path}: ${body.errors.join(", ")}`,
    );
  }
  return body.data;
}

async function apiSend<T>(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await failureMessage(res, path));
  }

  const payload = (await res.json()) as ApiResponse<T>;
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(
      `Backend returned errors for ${path}: ${payload.errors.join(", ")}`,
    );
  }
  return payload.data;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiSend<T>("POST", path, body);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiSend<T>("PATCH", path, body);
}

export async function seedSampleData(): Promise<string> {
  return apiPost<string>("/function/seedSampleData", {});
}

export async function seedMyCollection(): Promise<string> {
  return apiPost<string>("/function/seedMyCollection", {});
}

export async function backup(): Promise<unknown> {
  return apiPost<unknown>("/function/backup", {});
}

export async function importFromFile(): Promise<unknown> {
  return apiPost<unknown>("/function/importFromFile", {});
}

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
