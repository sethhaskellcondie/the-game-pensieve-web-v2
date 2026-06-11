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
  method: "POST" | "PATCH" | "PUT",
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

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiSend<T>("PUT", path, body);
}

// DELETE has its own helper because the backend answers a successful delete with
// 204 / an empty body, which apiSend would choke on when it tries to parse JSON.
export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: "DELETE",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await failureMessage(res, path));
  }

  // A 204 (or any empty body) means success with nothing to read.
  const text = (await res.text()).trim();
  if (!text) return;

  const payload = JSON.parse(text) as ApiResponse<unknown>;
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(
      `Backend returned errors for ${path}: ${payload.errors.join(", ")}`,
    );
  }
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

// Imports collection data supplied in the request body. The backend's /import
// endpoint expects the BackupData wrapped as { data }. Returns the unwrapped
// ImportResults `data`.
export async function importData(data: unknown): Promise<unknown> {
  return apiPost<unknown>("/function/import", { data });
}

// ---------- Custom fields ----------
// Shapes mirror the CustomField schemas in backend-documentation/openapi.yaml.

export type CustomFieldType =
  | "text"
  | "number"
  | "boolean"
  | "dropdown"
  | "radio_button"
  | "progress_bar";

export type EntityKey =
  | "toy"
  | "system"
  | "videoGame"
  | "videoGameBox"
  | "boardGame"
  | "boardGameBox";

export type CustomFieldOption = {
  id: number;
  customFieldId: number;
  name: string;
  isDefault: boolean;
  order: number;
};

export type CustomField = {
  id: number;
  name: string;
  type: CustomFieldType;
  entityKey: EntityKey;
  order: number;
  options: CustomFieldOption[];
};

// Options on create carry no id yet (the backend assigns one).
export type CreateCustomFieldOption = {
  name: string;
  order: number;
  isDefault: boolean;
};

export type CreateCustomFieldInput = {
  name: string;
  type: CustomFieldType;
  entityKey: EntityKey;
  options?: CreateCustomFieldOption[];
};

// On update the options array is a full replacement: existing options keep their
// id, new ones use id: null. Type and entityKey are not editable.
export type UpdateCustomFieldOption = {
  id: number | null;
  name: string;
  order: number;
  isDefault: boolean;
};

export type UpdateCustomFieldInput = {
  name: string;
  order: number;
  options?: UpdateCustomFieldOption[];
};

export function listCustomFieldsByEntity(
  key: EntityKey,
): Promise<CustomField[]> {
  return apiGet<CustomField[]>(`/custom_fields/entity/${key}`);
}

export function createCustomField(
  input: CreateCustomFieldInput,
): Promise<CustomField> {
  return apiPost<CustomField>("/custom_fields", { custom_field: input });
}

export function updateCustomField(
  id: number,
  input: UpdateCustomFieldInput,
): Promise<CustomField> {
  return apiPut<CustomField>(`/custom_fields/${id}`, { custom_field: input });
}

export function deleteCustomField(id: number): Promise<void> {
  return apiDelete(`/custom_fields/${id}`);
}

// ---------- Filters ----------
// Shapes mirror the FilterSpecification + FilterRequest schemas in
// backend-documentation/openapi.yaml.

// The available filters for an entity: `fields` maps each field name to its data
// type (text/number/boolean/time/system plus the sort/pagination pseudo-fields),
// and `filters` maps each field name to the operators it accepts. Only standard
// fields are listed here — custom fields are merged in client-side.
export type FilterSpecification = {
  type: string;
  fields: Record<string, string>;
  filters: Record<string, string[]>;
};

// One filter in a search request. `operand` is always a string (the backend
// coerces it per the field's type), matching how custom-field values are stored.
export type FilterRequestDto = {
  key: EntityKey;
  field: string;
  operator: string;
  operand: string;
};

export function getFilterSpec(entity: EntityKey): Promise<FilterSpecification> {
  return apiGet<FilterSpecification>(`/filters/${entity}`);
}

// ---------- Toys ----------
// Shapes mirror the Toy + CustomFieldValue schemas in
// backend-documentation/openapi.yaml.

// A custom field's value on a specific entity. `value` is always a string
// representation (e.g. "true"/"false" for booleans, "123" for numbers).
export type CustomFieldValue = {
  customFieldId: number;
  customFieldName: string;
  customFieldType: CustomFieldType;
  value: string;
};

export type Toy = {
  id: number;
  key: "toy";
  name: string;
  set: string;
  customFieldValues: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// The backend lists toys through a POST search endpoint; an empty filter set
// returns them all. apiPost unwraps the { data, errors } envelope for us.
export function searchToys(filters: FilterRequestDto[] = []): Promise<Toy[]> {
  return apiPost<Toy[]>("/toys/function/search", { filters });
}

// The update payload mirrors ToyRequest: name + set + the full custom-field
// value set are all required, so an inline edit of one field must resend the
// toy's existing values alongside the change.
export type UpdateToyInput = {
  name: string;
  set: string;
  customFieldValues: CustomFieldValue[];
};

export function updateToy(id: number, input: UpdateToyInput): Promise<Toy> {
  return apiPut<Toy>(`/toys/${id}`, { toy: input });
}

// Creating a toy takes the same shape as updating one (ToyRequest: name + set +
// the full custom-field value set), so the create payload reuses UpdateToyInput.
export type CreateToyInput = UpdateToyInput;

export function createToy(input: CreateToyInput): Promise<Toy> {
  return apiPost<Toy>("/toys", { toy: input });
}

// Fetch a single toy by id. Returns null on 404 so the detail page can render
// its own not-found state instead of throwing.
export function getToyById(id: number): Promise<Toy | null> {
  return apiGetOrNull<Toy>(`/toys/${id}`);
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
