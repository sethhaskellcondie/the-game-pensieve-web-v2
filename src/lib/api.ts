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

export function deleteToy(id: number): Promise<void> {
  return apiDelete(`/toys/${id}`);
}

// Fetch a single toy by id. Returns null on 404 so the detail page can render
// its own not-found state instead of throwing.
export function getToyById(id: number): Promise<Toy | null> {
  return apiGetOrNull<Toy>(`/toys/${id}`);
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
  return apiPost<System[]>("/systems/function/search", { filters });
}

// The update payload mirrors SystemRequest: name + generation + handheld + the
// full custom-field value set are all required, so an inline edit of one field
// must resend the system's existing values alongside the change.
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
  return apiPut<System>(`/systems/${id}`, { system: input });
}

// Creating a system takes the same shape as updating one (SystemRequest), so
// the create payload reuses UpdateSystemInput.
export type CreateSystemInput = UpdateSystemInput;

export function createSystem(input: CreateSystemInput): Promise<System> {
  return apiPost<System>("/systems", { system: input });
}

export function deleteSystem(id: number): Promise<void> {
  return apiDelete(`/systems/${id}`);
}

// Fetch a single system by id. Returns null on 404 so the detail page can
// render its own not-found state instead of throwing.
export function getSystemById(id: number): Promise<System | null> {
  return apiGetOrNull<System>(`/systems/${id}`);
}

// ---------- Video Games ----------
// Shapes mirror the VideoGame schemas in backend-documentation/openapi.yaml,
// with one divergence: the live API also returns a videoGameBoxes array on
// each game (the spec omits it). Only the fields the UI uses are typed here.
// Video games have no create or delete endpoints — they are created (and
// removed) through video game boxes.

export type SlimVideoGameBox = {
  id: number;
  title: string;
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
  return apiPost<VideoGame[]>("/videoGames/function/search", { filters });
}

// The update payload mirrors VideoGameRequest: title + systemId + the full
// custom-field value set are all required, so an inline edit of one field must
// resend the game's existing values alongside the change.
export type UpdateVideoGameInput = {
  title: string;
  systemId: number;
  customFieldValues: CustomFieldValue[];
};

export function updateVideoGame(
  id: number,
  input: UpdateVideoGameInput,
): Promise<VideoGame> {
  return apiPut<VideoGame>(`/videoGames/${id}`, { videoGame: input });
}

// Fetch a single video game by id. Returns null on 404 so the detail page can
// render its own not-found state instead of throwing.
export function getVideoGameById(id: number): Promise<VideoGame | null> {
  return apiGetOrNull<VideoGame>(`/videoGames/${id}`);
}

// ---------- Video Game Boxes ----------
// Shapes mirror the VideoGameBox schemas in backend-documentation/openapi.yaml.
// A box is the case (physical or digital) that holds one or more video games;
// games themselves are created and removed through boxes.

export type SlimVideoGame = {
  id: number;
  title: string;
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
  return apiPost<VideoGameBox[]>("/videoGameBoxes/function/search", {
    filters,
  });
}

// One game to create through a box write — mirrors VideoGameRequest (games
// have no standalone create endpoint; they are born inside a box).
export type NewVideoGameInput = {
  title: string;
  systemId: number;
  customFieldValues: CustomFieldValue[];
};

// The update payload mirrors VideoGameBoxRequest: every field is required, so
// an edit of one field must resend the rest. existingVideoGameIds carries the
// box's current game ids and newVideoGames stays empty when only editing box
// fields. isCollection is absent — the backend derives it from the game count.
export type UpdateVideoGameBoxInput = {
  title: string;
  systemId: number;
  existingVideoGameIds: number[];
  newVideoGames: NewVideoGameInput[];
  isPhysical: boolean;
  customFieldValues: CustomFieldValue[];
};

export function updateVideoGameBox(
  id: number,
  input: UpdateVideoGameBoxInput,
): Promise<VideoGameBox> {
  return apiPut<VideoGameBox>(`/videoGameBoxes/${id}`, {
    videoGameBox: input,
  });
}

// VideoGameBoxRequest is the same shape on POST and PUT, so the create payload
// reuses UpdateVideoGameBoxInput (games ride along in existingVideoGameIds /
// newVideoGames).
export type CreateVideoGameBoxInput = UpdateVideoGameBoxInput;

export function createVideoGameBox(
  input: CreateVideoGameBoxInput,
): Promise<VideoGameBox> {
  return apiPost<VideoGameBox>("/videoGameBoxes", { videoGameBox: input });
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
  return apiGetOrNull<VideoGameBox>(`/videoGameBoxes/${id}`);
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
  return apiPost<BoardGame[]>("/boardGames/function/search", { filters });
}

// The update payload mirrors BoardGameRequest: title + the full custom-field
// value set are required, so an inline edit of one field must resend the
// game's existing values alongside the change.
export type UpdateBoardGameInput = {
  title: string;
  customFieldValues: CustomFieldValue[];
};

export function updateBoardGame(
  id: number,
  input: UpdateBoardGameInput,
): Promise<BoardGame> {
  return apiPut<BoardGame>(`/boardGames/${id}`, { boardGame: input });
}

// Fetch a single board game by id. Returns null on 404 so the detail page can
// render its own not-found state instead of throwing.
export function getBoardGameById(id: number): Promise<BoardGame | null> {
  return apiGetOrNull<BoardGame>(`/boardGames/${id}`);
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
  return apiPost<BoardGameBox[]>("/boardGameBoxes/function/search", {
    filters,
  });
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
  return apiPost<BoardGameBox>("/boardGameBoxes", { boardGameBox: input });
}

// Update payload mirrors BoardGameBoxUpdateRequest, which differs from create:
// boardGameId is required and there is no inline boardGame. Every field is
// required, so an edit of one field must resend the rest.
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
    boardGameBox: input,
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
  return apiGetOrNull<BoardGameBox>(`/boardGameBoxes/${id}`);
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
