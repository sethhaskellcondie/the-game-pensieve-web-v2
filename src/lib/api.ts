// Single source of truth for talking to The Game Pensieve backend.
// Routes and the response envelope are documented in backend-documentation/openapi.yaml.
//
// Server-only: this module reads the session cookie (via next/headers) to attach
// the caller's bearer token, so it must only be imported from Server Components
// and Route Handlers — never from Client Components or middleware.

import { getBaseUrl } from "./apiBase";

// Carries the backend's HTTP status alongside the message so route handlers can
// translate auth/entitlement failures (401 not authenticated, 402 lapsed tried
// to filter, 403 lapsed tried to write) into the right client-facing status
// instead of collapsing everything to a generic 502.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// How the bearer token for an outbound call is resolved. This module is shared
// with Client Components (which import its types + pure helpers), so it must NOT
// itself depend on `next/headers`/iron-session — that would pull server-only code
// into the browser bundle. Instead the server installs a cookie-aware resolver at
// startup via setTokenResolver (see src/lib/serverAuth.ts + src/instrumentation.ts).
// The default resolves to the optional static API_TOKEN (undefined in the
// browser → anonymous → the backend serves the public showcase).
type TokenResolver = () => Promise<string | null>;

const DEFAULT_RESOLVER: TokenResolver = async () =>
  process.env.API_TOKEN ?? null;

// The resolver is stashed on `globalThis` (keyed by a global Symbol) rather than a
// module-level `let`. Next bundles `instrumentation.ts` in a SEPARATE module graph
// from route handlers / server components, so a plain module variable mutated by
// instrumentation is invisible to the api.ts instance the handlers actually run —
// the token silently never gets attached. `globalThis` is shared across every
// module instance in the Node process, so all of them see the same resolver.
const RESOLVER_KEY = Symbol.for("gamePensieve.tokenResolver");
type ResolverHost = { [RESOLVER_KEY]?: TokenResolver };

export function setTokenResolver(resolver: TokenResolver): void {
  (globalThis as ResolverHost)[RESOLVER_KEY] = resolver;
}

function resolveToken(): Promise<string | null> {
  const resolver = (globalThis as ResolverHost)[RESOLVER_KEY] ?? DEFAULT_RESOLVER;
  return resolver();
}

// How the admin-impersonation target ("act as user") for an outbound call is
// resolved. Mirrors the token resolver: api.ts is shared with Client Components
// so it can't read the session itself — the server installs a cookie-aware
// resolver at startup via setActAsResolver (see src/lib/serverAuth.ts +
// src/instrumentation.ts). The default resolves to no impersonation. When set,
// every backend call (reads/writes/search/backup) carries `X-Act-As-Owner`, so
// the request runs inside the target's tenant. The backend honors the header
// only for an authenticated ADMIN and ignores it on /v1/admin/** routes.
type ActAsResolver = () => Promise<number | null>;

const DEFAULT_ACT_AS_RESOLVER: ActAsResolver = async () => null;

const ACT_AS_KEY = Symbol.for("gamePensieve.actAsResolver");
type ActAsHost = { [ACT_AS_KEY]?: ActAsResolver };

export function setActAsResolver(resolver: ActAsResolver): void {
  (globalThis as ActAsHost)[ACT_AS_KEY] = resolver;
}

function resolveActAsOwner(): Promise<number | null> {
  const resolver = (globalThis as ActAsHost)[ACT_AS_KEY] ?? DEFAULT_ACT_AS_RESOLVER;
  return resolver();
}

// How the active public-showcase slug (the `gp_showcase` cookie) is resolved.
// Mirrors the token/act-as resolvers: api.ts can't read cookies itself, so the
// server installs a cookie-aware resolver at startup (see src/lib/serverAuth.ts
// + src/instrumentation.ts). The default resolves to no showcase. The header is
// attached ONLY to calls that opt in with `showcaseScoped: true` — collection
// data (entity search/get, filter specs, custom-field definitions feeding table
// columns) and the read-only showcase metadata views the loaders scope while a
// showcase is active (ui-settings, default_sort_options, saved-filters,
// saved-filter-categories) so a guest sees the OWNER's configured showcase.
// Truly personal routes (auth, admin, backup, import) must never send it:
// `X-Showcase` scopes the WHOLE request to the showcase owner as GUEST, so a
// call carrying it reads the owner's data, not the viewer's. Opt-in (rather than
// a URL denylist) keeps new endpoints personal by default.
type ShowcaseResolver = () => Promise<string | null>;

const DEFAULT_SHOWCASE_RESOLVER: ShowcaseResolver = async () => null;

const SHOWCASE_KEY = Symbol.for("gamePensieve.showcaseResolver");
type ShowcaseHost = { [SHOWCASE_KEY]?: ShowcaseResolver };

export function setShowcaseResolver(resolver: ShowcaseResolver): void {
  (globalThis as ShowcaseHost)[SHOWCASE_KEY] = resolver;
}

function resolveShowcaseSlug(): Promise<string | null> {
  const resolver =
    (globalThis as ShowcaseHost)[SHOWCASE_KEY] ?? DEFAULT_SHOWCASE_RESOLVER;
  return resolver();
}

// Per-call options for the request helpers. `showcaseScoped: true` marks a call
// as collection data, allowing the active showcase's `X-Showcase` header to be
// attached (when one is selected).
export type ApiCallOptions = { showcaseScoped?: boolean };

// Builds the outbound headers (Authorization, plus the act-as header while an
// admin is impersonating, plus `X-Showcase` on showcase-scoped calls while a
// showcase is selected) for a backend call. Never throws — a missing/garbled
// session just yields no auth header (anonymous → showcase) and no impersonation.
async function authHeaders(
  options: ApiCallOptions = {},
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  let token: string | null = null;
  try {
    token = await resolveToken();
  } catch {
    token = process.env.API_TOKEN ?? null;
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  let showcaseSlug: string | null = null;
  if (options.showcaseScoped) {
    try {
      showcaseSlug = await resolveShowcaseSlug();
    } catch {
      showcaseSlug = null;
    }
  }
  if (showcaseSlug) {
    // The backend gives X-Showcase priority over X-Act-As-Owner anyway, but we
    // omit the act-as header entirely so the outbound request states exactly
    // one intent (a read-only showcase view).
    headers["X-Showcase"] = showcaseSlug;
    return headers;
  }

  let actAsOwnerId: number | null = null;
  try {
    actAsOwnerId = await resolveActAsOwner();
  } catch {
    actAsOwnerId = null;
  }
  if (actAsOwnerId != null) {
    headers["X-Act-As-Owner"] = String(actAsOwnerId);
  }

  return headers;
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

export async function apiGet<T>(
  path: string,
  options: ApiCallOptions = {},
): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    cache: "no-store",
    headers: await authHeaders(options),
  });

  if (!res.ok) {
    throw new ApiError(res.status, await failureMessage(res, path));
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
export async function apiGetOrNull<T>(
  path: string,
  options: ApiCallOptions = {},
): Promise<T | null> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    cache: "no-store",
    headers: await authHeaders(options),
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new ApiError(res.status, await failureMessage(res, path));
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
  options: ApiCallOptions = {},
): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders(options)),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new ApiError(res.status, await failureMessage(res, path));
  }

  const payload = (await res.json()) as ApiResponse<T>;
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(
      `Backend returned errors for ${path}: ${payload.errors.join(", ")}`,
    );
  }
  return payload.data;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options: ApiCallOptions = {},
): Promise<T> {
  return apiSend<T>("POST", path, body, options);
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
    headers: await authHeaders(),
  });

  if (!res.ok) {
    throw new ApiError(res.status, await failureMessage(res, path));
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

// ---------- Showcases ----------
// Mirrors the Showcase schema: the public directory of visible showcases (slug +
// display name only — never owner emails). Public: no token required, and only
// showcases whose owner currently derives to PAID/ADMIN are listed. This call is
// itself never showcase-scoped (it's the directory you pick FROM).

export type ShowcaseDto = {
  slug: string;
  name: string;
};

export function listShowcases(): Promise<ShowcaseDto[]> {
  return apiGet<ShowcaseDto[]>("/showcases");
}

// ---------- Admin (role management) ----------
// Mirrors the AdminUser / SetRoleOverrideRequest schemas. Roles use the backend's
// uppercase vocabulary. These routes are ADMIN-only: a non-admin caller gets 403
// and an anonymous caller 401 (surfaced to the browser via errorResponse).

export type BackendRole = "GUEST" | "TRIAL" | "PAID" | "LAPSED" | "ADMIN";

export type AdminUser = {
  id: number;
  email: string;
  // The effective per-request role (already reflects any override).
  role: BackendRole;
  // The admin pin, or null when the role is auto-derived.
  roleOverride: BackendRole | null;
  // Access window expiry as epoch ms, or null for no window.
  accessUntil: number | null;
  // Informational billing status (e.g. trialing, active, past_due), or null.
  subscriptionStatus: string | null;
  // The user's public showcase address + display title, or null when their
  // collection is private. A granted slug is only publicly visible while the
  // owner derives to PAID/ADMIN — it can be set here yet absent from the
  // directory (reserved but dark).
  showcaseSlug: string | null;
  showcaseName: string | null;
};

export function listAdminUsers(): Promise<AdminUser[]> {
  return apiGet<AdminUser[]>("/admin/users");
}

// Pins the target user to a role, or clears the pin with `null` to revert to
// auto-derivation. Returns the updated account.
export function setUserRoleOverride(
  id: number,
  roleOverride: BackendRole | null,
): Promise<AdminUser> {
  return apiPost<AdminUser>(`/admin/users/${id}/role`, { roleOverride });
}

// Grants (or edits) the target user's public showcase, or clears it with a
// null/blank slug. The backend enforces the slug format
// (^[a-z0-9](-?[a-z0-9])*$, max 63 chars) and uniqueness, answering violations
// with a 400 whose message should be surfaced verbatim. Returns the updated
// account.
export function setUserShowcase(
  id: number,
  input: { slug: string | null; name: string | null },
): Promise<AdminUser> {
  return apiPost<AdminUser>(`/admin/users/${id}/showcase`, input);
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

// Showcase-scoped: while viewing a showcase the table columns / filter options
// must describe the OWNER's custom fields, not the viewer's. (The manage page
// on /custom-fields is unreachable in showcase mode, so the scoped read never
// leaks owner definitions into a personal editing surface.) Note: under the
// backend's `secured` profile this endpoint requires a token — anonymous
// callers get a 401, which consumers must degrade to "no custom fields".
export function listCustomFieldsByEntity(
  key: EntityKey,
): Promise<CustomField[]> {
  return apiGet<CustomField[]>(`/custom_fields/entity/${key}`, {
    showcaseScoped: true,
  });
}

// listCustomFieldsByEntity for read-only rendering paths (detail pages, table
// columns) that must survive anonymous browsing under the `secured` profile,
// where /custom_fields requires a token: an auth/entitlement failure (401/403)
// degrades to "no custom fields" instead of crashing the page. Other failures
// still throw — a broken backend should not silently render an empty column
// set for authenticated users.
export async function listCustomFieldsByEntityOrEmpty(
  key: EntityKey,
): Promise<CustomField[]> {
  try {
    return await listCustomFieldsByEntity(key);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      return [];
    }
    throw error;
  }
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

// Showcase-scoped: filter discovery describes the collection being viewed.
export function getFilterSpec(entity: EntityKey): Promise<FilterSpecification> {
  return apiGet<FilterSpecification>(`/filters/${entity}`, {
    showcaseScoped: true,
  });
}

// ---------- Toys ----------
// Shapes mirror the Toy + CustomFieldValue schemas in
// backend-documentation/openapi.yaml.

// A custom field's value on a specific entity. `value` is always a string
// representation (e.g. "true"/"false" for booleans, "123" for numbers). The
// enum kinds (dropdown/radio_button/progress_bar) store the value as an option
// reference: `valueOptionId` is the selected option's id and `value` is that
// option's current text. On write the backend reads only `valueOptionId` for
// enum kinds (the text is re-derived server-side, so option renames flow
// through automatically); for all other kinds `valueOptionId` is null.
export type CustomFieldValue = {
  customFieldId: number;
  customFieldName: string;
  customFieldType: CustomFieldType;
  value: string;
  valueOptionId: number | null;
};

// The option-backed ("enum") custom field types, whose values are stored as
// references to a CustomFieldOption rather than as text.
export function isEnumCustomFieldType(type: CustomFieldType): boolean {
  return (
    type === "dropdown" || type === "radio_button" || type === "progress_bar"
  );
}

// Build the CustomFieldValue entry for `def` set to `value` — the editors'
// string representation, which for enum kinds is the selected option's name.
// For enum kinds the option's id is resolved into valueOptionId (the part the
// backend actually reads on write); other kinds carry null.
export function toCustomFieldValue(
  def: CustomField,
  value: string,
): CustomFieldValue {
  return {
    customFieldId: def.id,
    customFieldName: def.name,
    customFieldType: def.type,
    value,
    valueOptionId: isEnumCustomFieldType(def.type)
      ? (def.options.find((o) => o.name === value)?.id ?? null)
      : null,
  };
}

// Build the CustomFieldValue entries for a create from the editors' id→string
// value map. A field left empty is omitted, since a create applies its values as
// a partial upsert — EXCEPT boolean fields. A boolean editor reads "" as off and
// shows "No", so an untouched boolean looks set to "No" in the dialog; omitting
// it would create the entity with no value at all (a blank cell). We send it
// explicitly as "false" so the saved data matches what the user saw. Each kept
// field is shaped by toCustomFieldValue, exactly as the detail pages send.
export function buildCustomFieldValues(
  definitions: CustomField[],
  values: Record<number, string>,
): CustomFieldValue[] {
  const out: CustomFieldValue[] = [];
  for (const def of definitions) {
    let raw = values[def.id] ?? "";
    if (raw === "") {
      if (def.type !== "boolean") continue;
      raw = "false";
    }
    out.push(toCustomFieldValue(def, raw));
  }
  return out;
}

// Keep only the entries the backend accepts on write. Reads can return
// placeholder entries for enum fields with no selection yet (`valueOptionId`
// null), but a write containing one is rejected with a 400. Since an entity
// write applies `customFieldValues` as a partial upsert — omitted entries are
// left unchanged — dropping the placeholders is safe and required. Every
// create/update in this module runs its values (including nested games')
// through this before sending.
export function writableCustomFieldValues(
  values: CustomFieldValue[],
): CustomFieldValue[] {
  return values.filter(
    (v) =>
      !isEnumCustomFieldType(v.customFieldType) || v.valueOptionId !== null,
  );
}

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
  return apiPost<Toy[]>("/toys/function/search", { filters }, {
    showcaseScoped: true,
  });
}

// The update payload mirrors ToyRequest: name and set are required, while
// customFieldValues is applied as a partial upsert (entries omitted from the
// array are left unchanged on the server).
export type UpdateToyInput = {
  name: string;
  set: string;
  customFieldValues: CustomFieldValue[];
};

export function updateToy(id: number, input: UpdateToyInput): Promise<Toy> {
  return apiPut<Toy>(`/toys/${id}`, {
    toy: {
      ...input,
      customFieldValues: writableCustomFieldValues(input.customFieldValues),
    },
  });
}

// Creating a toy takes the same shape as updating one (ToyRequest: name + set +
// the full custom-field value set), so the create payload reuses UpdateToyInput.
export type CreateToyInput = UpdateToyInput;

export function createToy(input: CreateToyInput): Promise<Toy> {
  return apiPost<Toy>("/toys", {
    toy: {
      ...input,
      customFieldValues: writableCustomFieldValues(input.customFieldValues),
    },
  });
}

export function deleteToy(id: number): Promise<void> {
  return apiDelete(`/toys/${id}`);
}

// Fetch a single toy by id. Returns null on 404 so the detail page can render
// its own not-found state instead of throwing.
export function getToyById(id: number): Promise<Toy | null> {
  return apiGetOrNull<Toy>(`/toys/${id}`, { showcaseScoped: true });
}

// ---------- Systems ----------
// Shapes mirror the System + CustomFieldValue schemas in
// backend-documentation/openapi.yaml. Systems differ from toys only in their
// standard fields: generation (integer) and handheld (boolean) replace set.

export type System = {
  id: number;
  key: "system";
  name: string;
  generation: number;
  handheld: boolean;
  customFieldValues: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// The backend lists systems through a POST search endpoint; an empty filter set
// returns them all. apiPost unwraps the { data, errors } envelope for us.
export function searchSystems(
  filters: FilterRequestDto[] = [],
): Promise<System[]> {
  return apiPost<System[]>("/systems/function/search", { filters }, {
    showcaseScoped: true,
  });
}

// The update payload mirrors SystemRequest: name, generation, and handheld are
// required, while customFieldValues is applied as a partial upsert (entries
// omitted from the array are left unchanged on the server).
export type UpdateSystemInput = {
  name: string;
  generation: number;
  handheld: boolean;
  customFieldValues: CustomFieldValue[];
};

export function updateSystem(
  id: number,
  input: UpdateSystemInput,
): Promise<System> {
  return apiPut<System>(`/systems/${id}`, {
    system: {
      ...input,
      customFieldValues: writableCustomFieldValues(input.customFieldValues),
    },
  });
}

// Creating a system takes the same shape as updating one (SystemRequest), so
// the create payload reuses UpdateSystemInput.
export type CreateSystemInput = UpdateSystemInput;

export function createSystem(input: CreateSystemInput): Promise<System> {
  return apiPost<System>("/systems", {
    system: {
      ...input,
      customFieldValues: writableCustomFieldValues(input.customFieldValues),
    },
  });
}

export function deleteSystem(id: number): Promise<void> {
  return apiDelete(`/systems/${id}`);
}

// Fetch a single system by id. Returns null on 404 so the detail page can
// render its own not-found state instead of throwing.
export function getSystemById(id: number): Promise<System | null> {
  return apiGetOrNull<System>(`/systems/${id}`, { showcaseScoped: true });
}

// ---------- Video Games ----------
// Shapes mirror the VideoGame schemas in backend-documentation/openapi.yaml,
// with one divergence: the live API also returns a videoGameBoxes array on
// each game (the spec omits it), and those nested boxes carry the box's system,
// its physical/collection flags, custom field values, and timestamps. Note the
// nested flags arrive as `physical`/`collection` (no `is` prefix), unlike the
// `isPhysical`/`isCollection` on a directly-fetched VideoGameBox.
// Video games have no create or delete endpoints — they are created (and
// removed) through video game boxes.

export type SlimVideoGameBox = {
  id: number;
  title: string;
  system: System;
  physical: boolean;
  collection: boolean;
  customFieldValues: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type VideoGame = {
  id: number;
  key: "videoGame";
  title: string;
  system: System;
  videoGameBoxes: SlimVideoGameBox[];
  customFieldValues: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// The backend lists video games through a POST search endpoint; an empty
// filter set returns them all. apiPost unwraps the { data, errors } envelope.
export function searchVideoGames(
  filters: FilterRequestDto[] = [],
): Promise<VideoGame[]> {
  return apiPost<VideoGame[]>("/videoGames/function/search", { filters }, {
    showcaseScoped: true,
  });
}

// The update payload mirrors VideoGameRequest: title and systemId are
// required, while customFieldValues is applied as a partial upsert (entries
// omitted from the array are left unchanged on the server).
export type UpdateVideoGameInput = {
  title: string;
  systemId: number;
  customFieldValues: CustomFieldValue[];
};

export function updateVideoGame(
  id: number,
  input: UpdateVideoGameInput,
): Promise<VideoGame> {
  return apiPut<VideoGame>(`/videoGames/${id}`, {
    videoGame: {
      ...input,
      customFieldValues: writableCustomFieldValues(input.customFieldValues),
    },
  });
}

// Fetch a single video game by id. Returns null on 404 so the detail page can
// render its own not-found state instead of throwing.
export function getVideoGameById(id: number): Promise<VideoGame | null> {
  return apiGetOrNull<VideoGame>(`/videoGames/${id}`, {
    showcaseScoped: true,
  });
}

// ---------- Video Game Boxes ----------
// Shapes mirror the VideoGameBox schemas in backend-documentation/openapi.yaml.
// A box is the case (physical or digital) that holds one or more video games;
// games themselves are created and removed through boxes.

export type SlimVideoGame = {
  id: number;
  title: string;
  system: System;
  customFieldValues: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type VideoGameBox = {
  id: number;
  key: "videoGameBox";
  title: string;
  system: System;
  videoGames: SlimVideoGame[];
  isPhysical: boolean;
  isCollection: boolean;
  customFieldValues: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// The backend lists video game boxes through a POST search endpoint; an empty
// filter set returns them all. apiPost unwraps the { data, errors } envelope.
export function searchVideoGameBoxes(
  filters: FilterRequestDto[] = [],
): Promise<VideoGameBox[]> {
  return apiPost<VideoGameBox[]>(
    "/videoGameBoxes/function/search",
    { filters },
    { showcaseScoped: true },
  );
}

// One game to create through a box write — mirrors VideoGameRequest (games
// have no standalone create endpoint; they are born inside a box).
export type NewVideoGameInput = {
  title: string;
  systemId: number;
  customFieldValues: CustomFieldValue[];
};

// The update payload mirrors VideoGameBoxRequest: every standard field is
// required, so an edit of one field must resend the rest, while each
// customFieldValues array is applied as a partial upsert. existingVideoGameIds
// carries the box's current game ids and newVideoGames stays empty when only
// editing box fields. isCollection is absent — the backend derives it from the
// game count.
export type UpdateVideoGameBoxInput = {
  title: string;
  systemId: number;
  existingVideoGameIds: number[];
  newVideoGames: NewVideoGameInput[];
  isPhysical: boolean;
  customFieldValues: CustomFieldValue[];
};

// Box writes carry custom field values at two levels (the box's own and each
// inline new game's); both get the unwritable placeholders dropped.
function writableVideoGameBoxInput(
  input: UpdateVideoGameBoxInput,
): UpdateVideoGameBoxInput {
  return {
    ...input,
    newVideoGames: input.newVideoGames.map((g) => ({
      ...g,
      customFieldValues: writableCustomFieldValues(g.customFieldValues),
    })),
    customFieldValues: writableCustomFieldValues(input.customFieldValues),
  };
}

export function updateVideoGameBox(
  id: number,
  input: UpdateVideoGameBoxInput,
): Promise<VideoGameBox> {
  return apiPut<VideoGameBox>(`/videoGameBoxes/${id}`, {
    videoGameBox: writableVideoGameBoxInput(input),
  });
}

// VideoGameBoxRequest is the same shape on POST and PUT, so the create payload
// reuses UpdateVideoGameBoxInput (games ride along in existingVideoGameIds /
// newVideoGames).
export type CreateVideoGameBoxInput = UpdateVideoGameBoxInput;

export function createVideoGameBox(
  input: CreateVideoGameBoxInput,
): Promise<VideoGameBox> {
  return apiPost<VideoGameBox>("/videoGameBoxes", {
    videoGameBox: writableVideoGameBoxInput(input),
  });
}

// Deleting a box also deletes any of its games that live in no other box
// (games exist only through boxes).
export function deleteVideoGameBox(id: number): Promise<void> {
  return apiDelete(`/videoGameBoxes/${id}`);
}

// Fetch a single video game box by id. Returns null on 404 so the detail page
// can render its own not-found state instead of throwing.
export function getVideoGameBoxById(
  id: number,
): Promise<VideoGameBox | null> {
  return apiGetOrNull<VideoGameBox>(`/videoGameBoxes/${id}`, {
    showcaseScoped: true,
  });
}

// ---------- Board Games ----------
// Shapes mirror the BoardGame schemas in backend-documentation/openapi.yaml,
// with one divergence: the live API returns richer box entries than the spec's
// SlimBoardGameBox (expansion flags, custom field values, and timestamps ride
// along). Board games have no create or delete endpoints — they are created
// (and removed) through board game boxes.

export type SlimBoardGameBox = {
  id: number;
  title: string;
  isExpansion: boolean;
  isStandAlone: boolean;
  baseSetId: number | null;
  customFieldValues: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type BoardGame = {
  id: number;
  key: "boardGame";
  title: string;
  boardGameBoxes: SlimBoardGameBox[];
  customFieldValues: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// The backend lists board games through a POST search endpoint; an empty
// filter set returns them all. apiPost unwraps the { data, errors } envelope.
export function searchBoardGames(
  filters: FilterRequestDto[] = [],
): Promise<BoardGame[]> {
  return apiPost<BoardGame[]>("/boardGames/function/search", { filters }, {
    showcaseScoped: true,
  });
}

// The update payload mirrors BoardGameRequest: title is required, while
// customFieldValues is applied as a partial upsert (entries omitted from the
// array are left unchanged on the server).
export type UpdateBoardGameInput = {
  title: string;
  customFieldValues: CustomFieldValue[];
};

export function updateBoardGame(
  id: number,
  input: UpdateBoardGameInput,
): Promise<BoardGame> {
  return apiPut<BoardGame>(`/boardGames/${id}`, {
    boardGame: {
      ...input,
      customFieldValues: writableCustomFieldValues(input.customFieldValues),
    },
  });
}

// Fetch a single board game by id. Returns null on 404 so the detail page can
// render its own not-found state instead of throwing.
export function getBoardGameById(id: number): Promise<BoardGame | null> {
  return apiGetOrNull<BoardGame>(`/boardGames/${id}`, {
    showcaseScoped: true,
  });
}

// ---------- Board Game Boxes ----------
// Shapes mirror the BoardGameBox schemas in backend-documentation/openapi.yaml.
// Unlike video game boxes (which hold many games), a board game box links to
// exactly one board game, and one game can have many boxes (base set, second
// copies, expansions). Expansion boxes point at their base set via baseSetId.

export type SlimBoardGame = {
  id: number;
  title: string;
  customFieldValues: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type BoardGameBox = {
  id: number;
  key: "boardGameBox";
  title: string;
  isExpansion: boolean;
  isStandAlone: boolean;
  baseSetId: number | null;
  boardGame: SlimBoardGame;
  customFieldValues: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// The backend lists board game boxes through a POST search endpoint; an empty
// filter set returns them all. apiPost unwraps the { data, errors } envelope.
export function searchBoardGameBoxes(
  filters: FilterRequestDto[] = [],
): Promise<BoardGameBox[]> {
  return apiPost<BoardGameBox[]>(
    "/boardGameBoxes/function/search",
    { filters },
    { showcaseScoped: true },
  );
}

// A game to create through a box write — mirrors BoardGameRequest (games have
// no standalone create endpoint; they are born inside a box).
export type NewBoardGameInput = {
  title: string;
  customFieldValues: CustomFieldValue[];
};

// Create payload mirrors BoardGameBoxRequest: exactly one of boardGameId
// (link an existing game) or boardGame (create a new game inline) must be set.
export type CreateBoardGameBoxInput = {
  title: string;
  isExpansion: boolean;
  isStandAlone: boolean;
  baseSetId: number | null;
  boardGameId: number | null;
  boardGame: NewBoardGameInput | null;
  customFieldValues: CustomFieldValue[];
};

export function createBoardGameBox(
  input: CreateBoardGameBoxInput,
): Promise<BoardGameBox> {
  return apiPost<BoardGameBox>("/boardGameBoxes", {
    boardGameBox: {
      ...input,
      boardGame: input.boardGame && {
        ...input.boardGame,
        customFieldValues: writableCustomFieldValues(
          input.boardGame.customFieldValues,
        ),
      },
      customFieldValues: writableCustomFieldValues(input.customFieldValues),
    },
  });
}

// Update payload mirrors BoardGameBoxUpdateRequest, which differs from create:
// boardGameId is required and there is no inline boardGame. Every standard
// field is required, so an edit of one field must resend the rest, while
// customFieldValues is applied as a partial upsert.
export type UpdateBoardGameBoxInput = {
  title: string;
  isExpansion: boolean;
  isStandAlone: boolean;
  baseSetId: number | null;
  boardGameId: number;
  customFieldValues: CustomFieldValue[];
};

export function updateBoardGameBox(
  id: number,
  input: UpdateBoardGameBoxInput,
): Promise<BoardGameBox> {
  return apiPut<BoardGameBox>(`/boardGameBoxes/${id}`, {
    boardGameBox: {
      ...input,
      customFieldValues: writableCustomFieldValues(input.customFieldValues),
    },
  });
}

export function deleteBoardGameBox(id: number): Promise<void> {
  return apiDelete(`/boardGameBoxes/${id}`);
}

// Fetch a single board game box by id. Returns null on 404 so the detail page
// can render its own not-found state instead of throwing.
export function getBoardGameBoxById(
  id: number,
): Promise<BoardGameBox | null> {
  return apiGetOrNull<BoardGameBox>(`/boardGameBoxes/${id}`, {
    showcaseScoped: true,
  });
}

// Result of the backend health check. `secureMode` mirrors the flag in the
// heartbeat payload: true when the backend runs the authenticated (`secured`
// profile) build, false for the default permit-all build, and null when it
// can't be determined (backend unreachable, or a body without the flag).
export type HeartbeatResult = {
  ok: boolean;
  secureMode: boolean | null;
};

export async function checkHeartbeat(
  { debug = false }: { debug?: boolean } = {},
): Promise<HeartbeatResult> {
  const url = `${getBaseUrl()}/heartbeat`;
  const res = await fetch(url, { cache: "no-store" });

  if (debug) {
    const body = await res.clone().text();
    console.log(
      `[heartbeat] GET ${url} → ${res.status} ${res.statusText}: ${body}`,
    );
  }

  if (!res.ok) {
    return { ok: false, secureMode: null };
  }

  // The envelope's `data` is `{ message, secureMode }`. Parse defensively —
  // a malformed body still counts as online (the service answered), just with
  // an unknown security posture.
  try {
    const body = (await res.json()) as {
      data?: { secureMode?: unknown } | null;
    };
    const secureMode = body.data?.secureMode;
    return {
      ok: true,
      secureMode: typeof secureMode === "boolean" ? secureMode : null,
    };
  } catch {
    return { ok: true, secureMode: null };
  }
}
