# Running the Playwright tests

The E2E specs assert against the sample data, so they assume the backend holds an
unmodified copy of it. Earlier specs mutate state (creating/deleting toys, boxes,
etc.), and a partial or stale import can leave records that throw off later
assertions. If the Playwright tests start failing for data-related reasons, delete
the database and import a fresh copy of the sample data before running them again.

# Backend Communication Architecture

Next.js (App Router) is full-stack. This project effectively has three layers:

1. The browser UI — React running in the user's browser.
2. The Next.js server — Server Components, Route Handlers, Server Actions, running
   on our host.
3. The real Game Pensieve backend — the existing API (e.g. http://localhost:8080/v1).

Layer 2 sits between the browser and the real backend (a "Backend-for-Frontend" /
proxy). Benefits: the real backend URL and any API token never ship to the browser,
we avoid CORS, and we get server-side rendering + caching. That is why
`API_BASE_URL` has NO `NEXT_PUBLIC_` prefix — it stays on the server (layer 2).

`src/lib/api.ts` is the single source of truth for talking to the real backend.
Everything on layer 2 uses it. What varies is *who triggers the call*:

- **Case 1 — Data loaded when a page renders** (the common case, e.g. `/toys`):
  the page is an async Server Component that calls `apiGet("/toys")` directly at
  render time, on the server, and ships finished HTML. No Route Handler needed.
  Most future pages work this way.

- **Case 2 — On-demand actions triggered by a click AFTER the page loads** (e.g. the
  heartbeat button): the trigger comes from the browser, which cannot reach
  `apiGet` directly (that's server-side, with the secret URL). It needs a server
  doorway — a Route Handler or Server Action — that then calls `apiGet`.

The heartbeat is the odd one out only because it is button-triggered and on-demand.
We chose a Route Handler (`/api/heartbeat`) because it's a clean named URL, the
browser can time the round-trip, and Playwright can mock it for ONLINE/OFFLINE
tests. We are NOT building a parallel backend or changing strategy — `src/lib/api.ts`
remains the one place that knows the real backend.

## The `src/lib/api.ts` toolkit

Every backend response uses the envelope `{ "data": ..., "errors": string[] | null }`.
The helpers unwrap it (returning `data`) and throw on a non-OK status or a non-empty
`errors` array, so callers work with plain values and let failures bubble up:

- `apiGet<T>(path)` — read. Throws on any non-OK status.
- `apiGetOrNull<T>(path)` — read that treats **404 as "not found"** and returns `null`
  instead of throwing. Use it for "does this exist yet?" checks (see UI settings below).
- `apiPost<T>(path, body)` / `apiPatch<T>(path, body)` — writes. They JSON-encode the
  body, send `Content-Type: application/json`, and unwrap the same envelope.
- `checkHeartbeat()` — special-cased because `/heartbeat` returns `text/plain`
  ("thump thump"), not the envelope, so it bypasses the unwrap logic.

All of these resolve the real backend URL through `getBaseUrl()` (reads `API_BASE_URL`,
falls back to `http://localhost:8080/v1` in development) and use `cache: "no-store"`.

## Worked example: UI settings (`ui-settings` metadata)

UI settings (mass-input / mass-edit / developer mode) are persisted in the backend's
`metadata` store under the key `ui-settings`. They exercise **both** cases above and
are a good template for future read+write features.

- **Read (Case 1, at startup):** the root `src/app/layout.tsx` is an async Server
  Component that awaits `loadUiSettings()` (`src/lib/uiSettings.ts`). That does a
  get-or-create: `apiGetOrNull("/metadata/ui-settings")`, and on `null` (404) it
  `apiPost`s a default record. The result seeds a Client Context provider
  (`UiSettingsProvider`) that wraps the whole app, so every component can read the
  settings via `useUiSettings()` and they are correct on first paint.

- **Write (Case 2, on a toggle):** the browser can't `apiPatch` directly, so flipping a
  toggle POSTs to the Route Handler `src/app/api/ui-settings/route.ts`, which calls
  `updateUiSettings()` → `apiPatch("/metadata/ui-settings", ...)`. Same pattern as the
  heartbeat: a thin server doorway over `src/lib/api.ts`.

### Convention: confirmed writes

Writes are **confirmed, not optimistic**. `setSetting` in `UiSettingsProvider` awaits
the Route Handler and only commits the new value to local state once the backend
acknowledges success (HTTP OK); a rejected or failed write leaves the UI on the last
known-good value rather than letting it diverge from the backend. While a write is in
flight the provider exposes `saving`, which the UI uses to disable controls and prevent
overlapping writes. New backend-mutating features should follow this shape: await the
proxy, commit on success, surface a pending/`saving` state.

### Data-shape boundary

The backend stores the settings `value` as a JSON-encoded **string** of snake_case keys
(`mass_input_mode`, etc.). The app works in camelCase (`massInputMode`). The mapping
lives in one place — `serializeUiSettings` / `parseUiSettingsValue` in
`src/lib/uiSettings.types.ts` — so the snake_case/JSON-string representation never leaks
past that boundary. (That file is kept free of server-only code so Client Components can
import the types and defaults safely.)

### Resilience

`loadUiSettings()` never throws: if the backend is unreachable, returns an error
envelope, or stores a malformed value, it falls back to all-`false` defaults so the app
always renders — the same "fail soft" stance the heartbeat takes by reporting OFFLINE
instead of surfacing a 500.

# Public Showcases (multi-tenant viewing)

A **showcase** is another user's collection made public by the backend
(`GET /v1/showcases` lists the visible ones; an `X-Showcase: <slug>` request
header scopes any read to that collection as GUEST — read + filter only, for
every caller, winning over admin impersonation).

## The `gp_showcase` cookie

The active selection is a plain httpOnly cookie holding just the slug, kept
**separate from `gp_session`** so anonymous visitors can select a showcase
without minting a session and clearing it never touches auth state. No cookie =
the "home" state (own collection when logged in, the backend's default showcase
when anonymous). It is set/cleared only by `POST /api/showcase/select`, which
validates the slug against the live directory first (junk or dark slugs are
rejected with a 404) and stops any active impersonation; starting impersonation
symmetrically clears the cookie, so the two banners can never show at once.

## Header attachment (opt-in, server side)

`src/lib/api.ts` gained a third resolver alongside the token and act-as
resolvers: `setShowcaseResolver`, installed by
`installServerShowcaseResolver()` (`src/lib/serverAuth.ts`, wired in
`src/instrumentation.ts`). The header is attached **only** to calls that pass
`{ showcaseScoped: true }` — the six entities' search/get-by-id, filter specs,
and per-entity custom-field reads (the table columns must describe the OWNER's
fields). Personal routes (auth, admin, ui-settings, saved filters, default
sorts, backup/import) never send it: `X-Showcase` scopes the whole request to
the showcase owner, so a metadata call carrying it would read the owner's
settings instead of the viewer's. Opt-in keeps new endpoints personal by
default.

Resolution goes through `resolveActiveShowcase()` (`src/lib/serverShowcase.ts`,
memoized per request with React `cache()`): the slug is checked against the
directory, which yields the display name for the banner AND marks vanished
slugs `stale` — a stale slug gets no header (that render falls back to the home
state instead of cascading backend 404s) and the client clears the cookie and
toasts.

## Capability collapse

`SessionView` (seeded server-side in the layout) carries
`activeShowcase: {slug, name} | null`. When it is set,
`capabilitiesFor(role, activeShowcase)` collapses the collection capabilities
to the guest row (`canWrite=false, canFilter=true, canImport=false,
canBackup=false`) while account-level state (`isAdmin`, the account menu,
`/account`) still reflects the real user. All existing component gating then
renders correctly with no per-component changes. The Custom Fields and Options
pages (viewer-personal surfaces) are hidden from the sidebar and redirect to
`/` in showcase mode.

## Stale-slug handling

If a showcase vanishes mid-visit (owner lapses, grant revoked), a
showcase-scoped backend call returns the tenant filter's 404 envelope
("No public showcase exists…"). `errorResponse` (`src/lib/bffError.ts`)
recognizes it, clears `gp_showcase`, and answers 404 with
`code: "SHOWCASE_UNAVAILABLE"`; `bffFetch` routes that to the session
provider's `onShowcaseGone` handler, which toasts and re-renders the home
state.

## Admin management

`/admin` (UsersManager) shows each user's grant (`showcaseSlug`/`showcaseName`
on `AdminUser`) with a Grant/Edit modal posting to
`POST /api/admin/users/{id}/showcase` (blank slug clears). Backend validation
400s (slug taken / bad format) surface verbatim. A grant whose owner isn't
PAID/ADMIN is flagged "not visible" — reserved but absent from the public
directory until the owner renews.
