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
