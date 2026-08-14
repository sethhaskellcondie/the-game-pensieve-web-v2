# Developer Documentation

`README.md` covers installing and running. 
Known bugs live in `documentation/knownIssues.md`.

---

## 1. Orientation

Next.js 16 (App Router), React 19, TypeScript. No UI framework, no state library,
no data-fetching library — a deliberately short dependency list (`@dnd-kit` and
`iron-session` are the only significant runtime additions).

Next.js is full-stack, so there are three layers:

1. The browser UI — React in the user's browser.
2. The Next.js server — Server Components, Route Handlers, the proxy.
3. The Game Pensieve API (separate repo).

Layer 2 is a **Backend-for-Frontend**. The backend URL and the caller's bearer
token never ship to the browser, CORS is never an issue, and pages server-render
with data already in hand. That is why `API_BASE_URL` has **no**
`NEXT_PUBLIC_` prefix — it stays on the server.

The practical consequence, and the thing to internalize first: **the browser
never talks to the backend.** It talks to `/api/*` route handlers in this repo,
which talk to the backend through `src/lib/api.ts`.

---

## 2. Project layout

```
src/app/                 Routes (App Router). Pages are async Server Components.
src/app/api/             The BFF route handlers — the browser's only backend door.
src/components/          UI, grouped by feature (auth/, filters/, toys/, home/, …).
src/lib/                 Data client, session/auth, metadata stores, shared hooks.
src/proxy.ts             Next 16 "proxy" (formerly middleware) — silent token refresh.
src/instrumentation.ts   Server-startup wiring for the api.ts resolvers.
__tests__/               Jest + React Testing Library.
e2e/                     Playwright specs (*.spec.ts) and their helpers.
documentation/           This file and knownIssues.md.
localFiles/              Scratch/reference material. Never referenced from code.
```

### Routes

Collection pages (`/toys`, `/systems`, `/video-games`, `/board-games`) each have
a detail route at `/{entity}/[id]`. Beyond those: `/` (the saved-filters
dashboard), `/custom-fields`, `/options`, `/login`, `/account`, `/admin`,
`/pricing`.

The backend's `EntityKey` is the routing key throughout the app — it keys the
custom-field registry, the metadata stores, the standard-field visibility
settings, and the filter spec lookups. Keep a new per-entity state keyed on it
rather than inventing parallel vocabulary.

The two game collections render list or shelf from a **URL param**
(`?view=list` / `?view=shelf`) rather than client state, so the server renders
the matching manager and the choice survives reloads and back navigation. That is
why `ViewToggle` is a pair of plain links. A bare URL falls back to the user's
`videoGamesDefaultView` / `boardGamesDefaultView` setting. Naming wart: both
collections share `ViewToggle` (filed under `src/components/video-games/`) and
`parseVideoGamesViewParam` (`src/lib/videoGamesView.ts`, kept React-free so the
resolution stays unit-testable even though the pages are async Server
Components); the board games page just passes `basePath="/board-games"`.

### Layout and provider stack

`src/app/layout.tsx` is an async Server Component that loads the UI settings and
the session view **in parallel**, then seeds three client providers:

```
ToastProvider → SessionProvider → UiSettingsProvider → { MobileNav | Sidebar } + banners + children
```

Seeding server-side is deliberate: capabilities, the active showcase, and the UI
settings are all correct on **first paint**, with no loading flash and no
client-side fetch waterfall.

### `export const dynamic = "force-dynamic"`

Set in the root layout so it cascades to every route. `API_BASE_URL` is supplied
only at runtime, never at build time, so any attempt to prerender a page during
`next build` would fail against an unreachable backend. Do not remove this, and
do not add `generateStaticParams` to collection routes.

### Styling

- **CSS Modules per component** (`Foo.module.css` next to `Foo.tsx`). No
  CSS-in-JS, no utility framework.
- **Design tokens live in `src/app/globals.css`** as CSS custom properties — the
  palette (`--primary`, `--ink-navy`, `--cannon-red`, …), the custom-field colors
  (`--field-blue-bg`, `--field-mint-text`, …), and reusable composite surfaces
  (`--surface-blue-grid` for the retro table headers, `--surface-paper-grid` for
  page backgrounds). Use a token; do not hard-code a hex.
- Fonts load through `next/font/google` and are exposed as
  `--font-jetbrains-mono` / `--font-press-start`.
- `reactCompiler: true` is on. Manual `useMemo`/`useCallback` for pure render
  performance is usually redundant.

---

## 3. The data client

`src/lib/api.ts` is the single source of truth for talking to the backend. What
varies is *who triggers the call*:

- **Case 1 — data loaded when a page renders** (the common case): the page is an
  async Server Component that calls e.g. `searchToys()` directly at render time
  and ships finished HTML. No route handler needed.
- **Case 2 — an action triggered by a click after the page loads**: the browser
  cannot reach `api.ts`, so it needs a server doorway — a route handler under
  `src/app/api/` that calls `api.ts` on its behalf.

### The toolkit

The helpers unwrap the response envelope (returning `data`) and throw an
`ApiError` — carrying the backend's HTTP **status** alongside the message — on a
non-OK status or a non-empty `errors` array. Callers work with plain values.

- `apiGet<T>(path, options?)` — read. Throws on any non-OK status.
- `apiGetOrNull<T>(path, options?)` — treats **404 as "not found"** and returns
  `null`. Use it for get-or-create checks and for detail pages that render their
  own not-found state.
- `apiPost<T>(path, body, options?)` / `apiPut<T>` / `apiPatch<T>` /
  `apiDelete(path)` — writes.
- `checkHeartbeat()` — special-cased because `/heartbeat` is a health probe, not
  a data read: it never throws, reporting `{ ok, secureMode }` instead.

All resolve the base URL through `getBaseUrl()` (`src/lib/apiBase.ts`, kept in
its own module free of `next/headers` so the proxy can import it) and use
`cache: "no-store"`.

`ApiCallOptions` currently carries one flag, `showcaseScoped` — see §7.

### The resolver pattern (and the `globalThis` quirk)

`api.ts` needs three pieces of per-request context: the bearer token, the
admin-impersonation target, and the active showcase slug. It cannot read any of
them itself, because **Client Components import `api.ts`** for its types and pure
helpers — importing `next/headers` or iron-session there would pull server-only
code into the browser bundle.

So the server *installs* resolvers at startup:

```
src/instrumentation.ts  →  src/lib/serverAuth.ts  →  setTokenResolver / setActAsResolver / setShowcaseResolver
```

Each resolver reads the request-scoped session at call time, so one install
covers every server render and route handler. Without an install, the defaults
apply: the static `API_TOKEN` env var (or nothing), no impersonation, no
showcase.

**The quirk:** the resolvers are stashed on `globalThis` under a
`Symbol.for(...)` key, not in a module-level `let`. Next bundles
`instrumentation.ts` in a **separate module graph** from route handlers and
Server Components — a plain module variable mutated by instrumentation is
invisible to the `api.ts` instance the handlers actually run against, and the
token silently never gets attached. `globalThis` is shared across every module
instance in the Node process. If you add a fourth resolver, follow this pattern
exactly.

### Route handler conventions

`src/app/api/` mirrors the backend for everything the browser needs on demand.
Two shared pieces keep the handlers consistent:

- **`src/lib/bffError.ts` — `errorResponse()`.** Maps an `ApiError` to the status
  the browser needs. 401/402/403 pass through untouched (§5); everything else
  collapses to a generic 502. One 404 is special-cased for vanished showcases
  (§7).
- **`src/lib/bffClient.ts` — `bffFetch()`.** A drop-in for `fetch` on the client.
  It returns the `Response` unchanged (callers keep their own `res.ok` handling);
  its only added behavior is firing the auth/capability handlers that
  `SessionProvider` registers, so a 401 redirects to login and a 402/403 raises
  the upgrade prompt instead of failing silently. Prefer it over bare `fetch` for
  any `/api/*` call.

### Convention: confirmed writes, not optimistic

Writes are **confirmed**. The pattern (`setSetting` in `UiSettingsProvider` is
the reference implementation): await the route handler, commit to local state
only once the backend acknowledges success, and expose a `saving` flag while the
write is in flight so the UI can disable controls and prevent overlapping writes.
A rejected write leaves the UI on the last known-good value rather than letting it
diverge from the backend. New backend-mutating features should follow this shape.

---

## 4. Authentication (Keycloak OIDC)

The BFF is a confidential OIDC client (`pensieve-web`) doing authorization-code +
PKCE. `src/lib/oidc.ts` is a hand-rolled client (fetch + Web Crypto, no library,
matching the codebase's dependency-light style) — server-only, but deliberately
free of `next/headers` and iron-session so the proxy can use it too. There is no
in-app password form and no register endpoint.

### The flow

| Step | Route | What happens |
| --- | --- | --- |
| Start | `GET /api/auth/login` | Generates PKCE verifier/challenge, CSRF `state`, and `nonce`; seals them into the short-lived `gp_oauth` cookie (10 min TTL); 302s to Keycloak's hosted login page. |
| Return | `GET /api/auth/callback` | Validates `state`, exchanges the code with the PKCE verifier, validates the id_token's `iss`/`nonce`, resolves the role via `GET /v1/auth/me`, writes the session cookies. |
| End | `POST /api/auth/logout` | Destroys the local cookies and returns an RP-initiated `logoutUrl` so the client can kill the Keycloak SSO session too, not just our cookie. |

The callback URL is derived from the **incoming request origin**, so host dev
(`:3000`) and compose (`:4200`) both work with no per-environment config — each
origin just has to be registered on the Keycloak client's `redirectUris`.

### Public vs internal issuer

Two env vars, and getting them backwards is a classic failure:

- **`OIDC_ISSUER` is browser-facing** — authorization redirects, end-session
  redirects, and `id_token.iss` validation.
- **`OIDC_INTERNAL_ISSUER` is server-facing** — token exchange and refresh. In
  compose the BFF container reaches Keycloak at `http://keycloak:8080` while
  tokens still carry the canonical `localhost:8081` issuer.

Tokens' `iss` is *always* the public issuer regardless of which endpoint minted
them, so we validate against the public one. In host dev leave
`OIDC_INTERNAL_ISSUER` unset — it falls back to `OIDC_ISSUER`.

### Three cookies, and why

| Cookie | Contents | Why separate |
| --- | --- | --- |
| `gp_session` | Sealed (iron-session): access token, refresh token, expiry, email, role, plan expiry, impersonation target. | The working session. The browser never sees its contents. |
| `gp_oidc` | Sealed: the id_token, used only as the logout hint. | **Three JWTs sealed together overflow the 4096-byte browser cookie limit.** The id_token is written once at login and read once at logout, never rotated, so splitting it out costs nothing. |
| `gp_showcase` | Plain httpOnly: just a showcase slug. | Lets an anonymous visitor select a showcase without minting a session; clearing it never touches auth state. |

(`gp_oauth`, the in-flight login transaction, is a fourth but lives only for the
seconds between the login redirect and the callback.)

Session shape and cookie names live in `src/lib/sessionConfig.ts` — kept free of
`next/headers` and `fetch` so it is importable from anywhere, including the
proxy. Server-only cookie *access* lives in `src/lib/session.ts`.

### Silent refresh in `src/proxy.ts`

Cookies cannot be written during an RSC render, so the refresh happens in the
proxy — before the request reaches any handler, where the response cookie can
still be set. It fires when the access token is expired or within
`REFRESH_SKEW_MS` (60s) of expiring.

Three behaviors to know before you touch this file:

1. **The request-cookie mirror.** `session.save()` writes the new sealed cookie
   to the *response* — so the browser gets it next time. But the handler serving
   *this* request reads its token from the *request* cookies via `cookies()`, so
   without intervention the very request that triggered the refresh would still
   go out with the old, expired token and 401. The proxy therefore mirrors the
   freshly-sealed cookie back onto the incoming request and forwards it
   downstream. Do not remove this.
2. **Role re-probe on every refresh.** A long-lived session can silently cross
   TRIAL → LAPSED, so each refresh re-reads `GET /v1/auth/me` and overwrites the
   stored role and plan expiry — but only when the probe gives a definitive
   answer (`null` means transient failure, and we keep the prior value rather
   than guessing something more restrictive). While impersonating, the probe
   carries the act-as header so the stored role stays the *effective* one.
3. **Fail-soft on refresh errors.** The session is destroyed only on a
   *definitive* `invalid_grant` at HTTP 400/401 — the refresh token is genuinely
   dead. Network hiccups and every other error leave the session alone. Logging a
   user out on a blip is worse than one failed request.

The proxy's matcher skips static assets, Next internals, and `api/auth` itself
(those routes manage the session directly and must not be intercepted
mid-login).

---

## 5. Capabilities in the UI

`Role` (`src/lib/sessionConfig.ts`) mirrors the backend's `AccessService`
vocabulary verbatim, and `capabilitiesFor()`
(`src/components/auth/SessionProvider.tsx`) mirrors its capability matrix. **The
backend is the source of truth — when it changes, change these in lockstep.**

### `canSeed` is separate from `canImport`

The backend gates the two seed endpoints (`/v1/function/seedSampleData`,
`/seedMyCollection`) on a **SEED** capability that only ADMIN holds, not on
IMPORT. The distinction is what the data *is*: IMPORT loads a document the
caller supplied — their own backup — and is a paid feature; SEED loads a fixture
file bundled in the backend's image, which is the maintainer's data. So a PAID
account may restore its own backup but gets a 403 from the seed endpoints, and
`BackupImport.tsx` maps its two seed actions to `canSeed` accordingly.

Note that the "Import From Backup" action (`/v1/function/importFromFile`) is
**unsecured-builds-only** on the backend and 404s against a hosted deployment.
It stays in the UI behind the developer-mode flag as a local convenience; the
failure against a secured server is expected, not a bug.

Three things here are ours, not the backend's:

### The `unknown` sentinel

An authenticated session whose role could not be resolved from
`GET /v1/auth/me` (endpoint down, transient failure) is stored as `unknown`. It
renders like LAPSED — the most restrictive authenticated state — and is surfaced
plainly in the UI rather than silently masquerading as a capable role. We never
invent a role a failed probe did not confirm; the backend still gates every
endpoint, so an `unknown` session can never exceed its real permissions.

### Two overrides sit in front of the matrix

- An **active showcase** collapses the collection capabilities to the guest row
  (§7).
- **Unsecured mode** grants the full collection row (§8).

Both are applied inside `capabilitiesFor`, which is why they work with no
per-component changes.

### Gating discipline

Components gate on the capability flags via `useSession()` — **never on the raw
role**. A component that checks `role === "paid"` breaks both overrides. This is
the single most important convention in the auth code.

### The status contract

Backend capability denials survive all the way to the browser and drive UI:

- **401** → redirect to login.
- **402** → upgrade prompt, and the provider optimistically flips to lapsed so
  controls disable immediately.
- **403** → capability denial. **Not implicitly "lapsed"** — the handler re-reads
  the authoritative role to decide what it means.

`errorResponse` passes these through; `bffFetch` fires the handlers;
`SessionProvider` owns the reactions.

---

## 6. Impersonation (frontend handling)

The act-as resolver attaches `X-Act-As-Owner` to *every* backend call while an
admin is impersonating, so there is nothing per-call to remember.

What the frontend does about it:

- The session's `email` stays the admin's, but `role` is **overwritten with the
  target's effective role**, so the capability matrix reflects the target with no
  special-casing.
- `ImpersonationBanner` keys off `isImpersonating`, **not** `isAdmin` — the
  effective role is not admin while acting.
- If `/v1/auth/me` reports no impersonation while the header was sent (e.g. the
  target was deleted), that is a desync: `/me` wins and the proxy clears
  impersonation.
- Impersonation and showcase viewing are **mutually exclusive**: starting either
  clears the other, so the two banners can never show at once.

---

## 7. Showcase mode (frontend handling)

### Selection

The active slug lives in the plain `gp_showcase` cookie, deliberately **separate
from `gp_session`** so an anonymous visitor can select a showcase without minting
a session and clearing it never touches auth state. No cookie = the "home" state.
It is set and cleared only by `POST /api/showcase/select`, which validates the
slug against the live directory first — junk or dark slugs are rejected with a
404 — and stops any active impersonation.

Selecting a showcase performs a **full navigation to `/`** — Server Components
must re-render under the new cookie, and leaving via the section root avoids
guaranteed 404s on another collection's detail URLs.

### Header attachment is opt-in

`X-Showcase` is attached **only** to calls that pass `{ showcaseScoped: true }`.
Opt-in rather than a URL denylist, because the header scopes the **whole
request** to the showcase owner — a call that carries it by accident reads the
owner's data instead of the viewer's. New endpoints are therefore personal by
default, which is the safe direction to fail.

Scoped today:

- Entity search and get-by-id.
- Filter specs and per-entity custom-field reads — the table columns must
  describe the **owner's** fields.
- The four metadata stores (§9), so a visitor sees the collection as its owner
  configured it.

Never scoped: auth, admin, backup, import.

### Resolution and stale slugs

`resolveActiveShowcase()` (`src/lib/serverShowcase.ts`, memoized per request with
React `cache()`) checks the slug against the directory. That yields the display
name for the banner and marks vanished slugs `stale`. A stale slug gets **no
header** — that render falls back to the home state instead of cascading backend
404s — and the client clears the cookie and toasts.

If a showcase vanishes mid-visit, a scoped call returns the tenant filter's 404
envelope. `errorResponse` recognizes it **by message substring**, clears
`gp_showcase` on the spot, and answers 404 with `code: "SHOWCASE_UNAVAILABLE"`;
`bffFetch` routes that to `SessionProvider`'s `onShowcaseGone` handler, which
toasts and re-renders the home state. (The substring match is the fragile link
here — if the backend rewords that message, this breaks silently.)

### Capability collapse

`SessionView.activeShowcase` drives `capabilitiesFor`, which collapses the
collection capabilities to the guest row while account-level state (`isAdmin`,
the account menu, `/account`) still reflects the real user. Custom Fields and
Options — viewer-personal surfaces — are hidden from the sidebar and redirect to
`/`.

### Persisted views are cleared on switch

Filters and sorts persist per entity in localStorage (§11) and reference a
collection's own fields, including per-collection custom fields. A filter saved
while viewing one collection is meaningless in another and the search endpoint
rejects it with a 400, so `clearPersistedCollectionViews()` wipes both namespaces
on every showcase change.

### Admin management

`UsersManager` shows each user's grant with a Grant/Edit modal posting to
`POST /api/admin/users/{id}/showcase` (blank slug clears). Backend validation
400s surface verbatim. A grant whose owner is not PAID/ADMIN is flagged "not
visible" in the UI — reserved but absent from the public directory until the
owner renews.

---

## 8. Unsecured mode (frontend handling)

### Detection

`src/lib/authMode.ts` resolves the profile from `GET /heartbeat`'s `secureMode`
flag via `checkHeartbeat()`, caches a definitive answer for the life of the
server process (the profile cannot change under a running backend), and **fails
closed to `"secured"`** — without caching — when the backend is unreachable or
predates the flag. Not caching the failure means a backend that comes up after
the frontend gets re-probed on the next request.

The resolved mode rides on `SessionView.authMode` (absent = `"secured"`), so
server and client branch on the same value.

### What changes

- **Capabilities**: the full collection row is granted to the anonymous caller,
  mirroring the backend's disabled enforcement. `isAdmin` stays false — there are
  no users or roles to administer. The showcase collapse still wins, since
  `X-Showcase` is GUEST-scoped in **both** profiles.
- **Auth-only pages** — `/login`, `/account`, `/admin`, `/pricing` — redirect
  home. Logging in against an unsecured backend would actively *break* the
  session: the token is ignored, `/v1/auth/me` resolves GUEST, and the stored
  role becomes `unknown`. That is why the login page must be unreachable, and why
  `GET /api/auth/login` also refuses with a 409 as a guard against direct hits.
- **Chrome**: the sidebar shows Options to the anonymous caller (they own the
  collection), `AccountMenu` renders nothing, and `ShowcaseBanner` drops its "log
  in to manage your collection" notice.
- **Options offers everything**: the admin-only gate on Developer Mode (and with
  it API Tools) opens, since roles do not exist here.
- **Stale cookies are ignored**: `toSessionView` discards session contents
  entirely, so a leftover `gp_session` from a secured deployment cannot surface
  as a half-logged-in state.

### One thing the frontend deliberately does *not* do

If an unsecured instance is pointed at a database that also holds secured-mode
data, the frontend adds no guard. Row-Level Security runs in both profiles, so
unsecured requests only ever see rows owned by the default-showcase user. The
database boundary already enforces it, and duplicating that check in the UI would
only create a second thing to keep correct.

---

## 9. The metadata store pattern

Four app-level preference stores live in the backend's `metadata` key/value
store. They all follow the same shape, so learn it once:

| Key | Module | Holds |
| --- | --- | --- |
| `ui-settings` | `src/lib/uiSettings.ts` | Mass input/edit, developer mode, beginner mode, animations, default views, standard-field visibility |
| `default_sort_options` | `src/lib/defaultSortOptions.ts` | Per-entity default sort levels |
| `saved-filters` | `src/lib/savedFilters.ts` | The home dashboard's shortcut cards |
| `saved-filter-categories` | `src/lib/savedFilterCategories.ts` | The dashboard's category grouping |

The shared conventions:

- **Get-or-create at load.** `apiGetOrNull("/metadata/{key}")`, and on `null`
  (404) `apiPost` a default record.
- **The stored `value` is a JSON-encoded *string* of snake_case keys**, while the
  app works in camelCase. The mapping lives in a paired `*.types.ts` module so
  that representation never leaks past the boundary.
- **The `*.types.ts` module is free of server-only code** — no `API_BASE_URL`, no
  `fetch` — so Client Components can import the types, defaults, and narrowing
  helpers safely.
- **Loaders never throw.** An unreachable backend, an error envelope, or a
  malformed value all fall back to defaults so the app still renders — the same
  fail-soft stance the heartbeat takes by reporting OFFLINE instead of a 500.
- **Untrusted values are narrowed field by field**, defaulting to *permissive*
  (see `asStandardFieldVisibility`) so a newly added field shows up rather than
  disappearing for existing users.

UI settings is the reference implementation of both call cases from §3: the root
layout awaits `loadUiSettings()` to seed `UiSettingsProvider` (Case 1), and a
toggle POSTs to `src/app/api/ui-settings/route.ts` (Case 2), confirmed not
optimistic.

### What the settings actually do

| Setting | Effect |
| --- | --- |
| `massInputMode` | Create modals stay open after a successful save and loop for the next entry. Backdrop dismissal is disabled while on. |
| `massEditMode` | Collection grids render inline editors in their cells. Requires `canWrite`. **Hidden on mobile** — the card layout is read/navigate-only by design. |
| `developerMode` | Reveals API Tools (heartbeat detail, seed/import developer actions). **Admin-gated in secured mode**; ungated in unsecured mode. |
| `beginnerMode` | Renders `BeginnerHint` callouts (copy lives in `src/components/beginnerHints.ts`). |
| `hideAnimations` | Drops the animated header treatment. |
| `videoGamesDefaultView` / `boardGamesDefaultView` | Which view a bare collection URL opens in. |
| `standardFields` | Per-entity visibility of the optional standard columns. The title/name column is always shown and has no entry. |

---

## 10. Custom fields in the UI

**`src/components/custom-fields/registry.tsx` is the single source of truth** for
the screen's type and entity metadata — labels, colors, glyphs, `hasOptions`.
Everything is keyed on the **backend enum values** so the design prototype's own
keys never leak into state. Colors reference the shared `--field-*` tokens in
`globals.css`.

`listCustomFieldsByEntityOrEmpty()` is the forgiving read — use it where a
missing or failing definition set should degrade to "no custom columns" rather
than blow up a page render.

### The null-placeholder quirk (read this before writing a save path)

Reads return option-bearing custom field values with **null enum placeholders**,
and echoing a `GET` response straight back into a `PUT`/`POST` will **400**.
Every write must pass its values through **`writableCustomFieldValues()`**, which
strips them. Every write helper in `api.ts` already does this — including for
nested payloads — so follow the existing helpers rather than hand-rolling a
request body.

The paired `buildCustomFieldValues()` goes the other way: it merges a field's
definitions with an entity's stored values to produce the full editable set.

---

## 11. Filters, sorting, and the dashboard

Read the filter spec; do not hard-code a field list. `OPERATORS_BY_KIND`
(`src/components/filters/operators.ts`) mirrors the spec for the standard kinds
and treats the option-bearing custom kinds as equality matches on the option
name.

Filtering is capability-gated on `canFilter` because it is a backend search, not
a client-side array operation.

### Where a page's filters and sorts come from

Three sources, in increasing specificity:

1. **Default sort options** — the `default_sort_options` store, applied when the
   page has nothing else. Levels are stored as `{ field, direction }` with no
   label; labels are re-resolved against the live field list on apply, so a level
   whose custom field was renamed away is simply dropped.
2. **The `filters` URL param** — a JSON array (`encodeFilterParam` /
   `decodeFilterParam` in `urlFilters.ts`) written by the dashboard's saved-filter
   cards, so clicking a card opens the page already filtered. Decoding is
   defensive (a malformed param yields no filters) and ids are deterministic and
   index-based so server and client render identically. Once on the page these
   behave like any hand-entered filter.
3. **localStorage** — whatever the user last had applied (§12).

### The home dashboard

`/` is a dashboard of saved filters grouped into categories. Each filter belongs
to exactly one category by `categoryId` and carries an `order` within it, so
reordering and moving between categories are both just edits to those two fields.
Reordering uses `@dnd-kit`.

Saved conditions store the persistable subset of an `ActiveFilter` plus its field
source (for the glyph). The heavy `options` array is deliberately **not** stored —
it is re-resolved from the live field list on edit, and the chip display only
needs the snapshotted `operandLabel`.

---

## 12. Client-side persistence

Some preferences are browser-only display state, not shared backend state, and
live in localStorage rather than the metadata store. The prefixes are the
namespace contract:

| Prefix | Written by | Holds |
| --- | --- | --- |
| `filters:` | `usePersistentFilters` | A page's applied filter conditions |
| `sorts:` | `usePersistentSorts` | A page's sort levels |
| `colWidths:` | `usePersistentColumnWidths` | Per-page data-table column widths |

`FILTERS_STORAGE_PREFIX` / `SORTS_STORAGE_PREFIX` in `persistedViews.ts` are the
single source of truth for the first two; both namespaces are wiped wholesale on
a showcase switch (§7).

**The column-width quirk:** `usePersistentColumnWidths` keeps a *session-scoped
in-memory cache* alongside localStorage, because the cache can be read
synchronously **during render** — so widths are restored the instant the user
navigates back to a page, without a post-mount effect that would flash the
defaults and race the save. It is safe to read during render precisely because it
is only ever *written* from effects: it stays empty during SSR and on the first
client render after a full page load (both render defaults, so no hydration
mismatch) and populates only later within the same session.

---

## 13. Mobile / adaptive UI

The app has a real mobile layout, not just a responsive stylesheet.

- **`MOBILE_BREAKPOINT = 768`** (`src/lib/useMediaQuery.ts`) is the single source
  of truth — **but CSS Modules cannot read a TS constant**, so width media
  queries hard-code `@media (max-width: 767px)`. If the breakpoint ever changes,
  both have to move together.
- **`useIsMobile()` reports `false` during SSR** and on the hydration render —
  desktop-first, matching the default layout — then corrects immediately on the
  client. Same defaults-first-then-correct pattern as the column widths. Branch
  on it only for components with a genuine mobile *variant*; purely cosmetic
  adjustments belong in a CSS media query so they do not pay for a subscription.
- **Conditional-mount twins.** `MobileNav` and `Sidebar` are both in the tree and
  switched purely in CSS at the breakpoint. Collection grids swap `DataTable` for
  `CardList` the same way.
- **`useMobileShelf()`** turns any dialog into a mobile "shelf": below the
  breakpoint it slides in from the right, stops below the page header, and slides
  off to the left on dismissal; above it, everything is inert. **Every** close
  affordance — X, Cancel, backdrop, Escape — must route through `requestClose` so
  the slide-out animation plays before the caller's `onClose` unmounts it. It
  honors `prefers-reduced-motion`.
- **Cards are read/navigate-only by decision.** The whole card is a stretched
  link; there is no delete action and no inline editors, regardless of what
  `massEditMode` says.
- The viewport meta tag is pinned explicitly in the root layout because the
  mobile layout depends on it. Zoom stays enabled — capping `maximumScale` or
  `userScalable` hurts accessibility.

`DataTable` is fully presentational: a `ColumnDef<Row>[]` with a `render`
callback per column means the table knows nothing about row shapes. Column
options cover `frozen`, `seam`, `align`, and `clip` (hard-clip instead of the
default ellipsis — the "…" marker is reserved for free-text columns). `CardList`
is its mobile counterpart with the same prop-driven design.

---

## 14. Environment, build, and deploy

| Variable | Required | Notes |
| --- | --- | --- |
| `API_BASE_URL` | Yes in production | Backend base URL **including `/v1`**. No `NEXT_PUBLIC_` prefix — server-only. Falls back to `http://localhost:8080/v1` in development; **throws at runtime if unset outside development**. |
| `SESSION_SECRET` | Yes in production — **enforced** | iron-session encryption password, ≥ 32 chars. A dev-only default is committed in `.env.development` so the app and E2E run out of the box. **In production the server refuses to start** if this is unset or shorter than 32 chars, rather than falling back to that committed default — see below. |
| `OIDC_ISSUER` | Yes (secured) | Browser-facing issuer. |
| `OIDC_INTERNAL_ISSUER` | Compose only | Server-facing issuer. Unset in host dev → falls back to `OIDC_ISSUER`. |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | Yes (secured) | Confidential client `pensieve-web`. |
| `API_TOKEN` | Optional | Static fallback bearer token for non-interactive/server deployments. Interactive users authenticate through the session instead. |

`.env.development` holds committed non-secret dev defaults; `.env.local`
(gitignored) is for secrets and overrides; `.env.example` documents the full set.

### `SESSION_SECRET` fails closed in production

`gp_session` carries live Keycloak **access and refresh** tokens, and the dev
fallback is committed to this repository — so a production instance that fell
back to it would let anyone forge a session for any account, while looking
completely healthy. `resolveSessionSecret()` (`src/lib/sessionConfig.ts`)
therefore throws in production when the variable is unset or under 32 chars.

Three details there are load-bearing and easy to undo by accident:

- **It is not evaluated at module load.** `next build` runs with
  `NODE_ENV=production` and imports every route module while collecting page
  data, so a top-level throw fails the *image build* on a machine that has no
  business holding the production secret. Do not "simplify" it back to a
  module-scope constant.
- **`sessionOptions.password` is an accessor, not a value**, so every seal and
  unseal passes the check — there is no path that can encrypt a cookie with the
  dev secret in production.
- **`instrumentation.ts` calls it eagerly at server start and `process.exit(1)`s
  on failure.** Throwing alone is not enough: Next catches a failing
  instrumentation hook, logs "Failed to prepare server", and leaves the process
  running — a container that reports `running` forever while serving nothing.

`compose.production.yaml` (in the API repo) additionally guards the variable with
`${SESSION_SECRET:?...}`, so a blank value aborts `docker compose up` in a second
with the variable named, rather than surfacing later in a container log.

Typical local ports: **3000** app, **8080** backend, **8081** Keycloak, **4200**
app under compose.

`next.config.ts` sets `output: "standalone"`, so `next build` emits a
self-contained server under `.next/standalone` with only the traced runtime
dependencies. The `Dockerfile` is a two-stage build (node:22-alpine) that copies
the standalone output plus `.next/static` and `public`, and runs `node server.js`.
`API_BASE_URL` must be supplied at container runtime.

---

## 15. Testing

Two suites. Both are expected to pass before a change lands.

### Jest + React Testing Library (`__tests__/`)

Config in `jest.config.ts`; `e2e/` is explicitly ignored so Playwright specs are
not picked up.

- Favor testable designs: keep components **prop-driven and presentational**,
  isolate logic into `src/lib`.
- Assert on **accessible roles, names, and attributes** (`aria-current`,
  `aria-label`), not CSS Module class names — which are hashed and are an
  implementation detail.
- **Jest cannot render `async` Server Components.** Cover those with E2E instead.
- A component rendered without a `SessionProvider` gets a fully-capable default
  session, so it renders in its complete (writable, filterable) form. Tests that
  exercise guest/lapsed/trial gating must wrap the component in a
  `<SessionProvider>` with the relevant view.

Run: `npm test` (`npm run test:watch` to iterate).

### Playwright (`e2e/`)

Config in `playwright.config.ts`. Five projects:

| Project | Runs |
| --- | --- |
| `setup` | `auth.setup.ts` only — signs in and saves the storage state |
| `chromium` / `firefox` / `webkit` | Every spec **without** `@mobile` in its title |
| `mobile-chromium` (Pixel 7) | Only specs **with** `@mobile` in the title |

**Form-factor convention:** untagged specs are desktop-only. Mobile coverage is
added as explicit `@mobile` **twin** specs, not by rerunning desktop specs at a
phone size.

**Auth:** `auth.setup.ts` drives the real Keycloak hosted-login flow
(`keycloakLogin.ts`) as the seeded test user (`E2E_KC_USER`, default `seth`) and
saves the session cookie to `e2e/.auth/user.json` (gitignored). Specs that
**write** data opt in with `test.use({ storageState: AUTH_STATE })`. Anonymous
browsers are guests viewing the public showcase read-only, so guest specs simply
do not opt in. The setup is mode-aware: against an **unsecured** backend it saves
an empty state instead of failing, and `e2e/unsecured.spec.ts` carries that mode's
coverage while the secured-mode specs (plan badges, login, showcases) are expected
not to pass.

**Seeding:** detail pages fetch server-side, so `page.route` cannot stub them.
`apiSeed.ts` creates real rows through the BFF using the authenticated session,
with salted names so parallel browsers on the shared account never collide.
`customFieldsStub.ts` is the exception — it stubs `/api/custom-fields/**` with an
in-memory store, since that screen is fully client-driven.

**The shared-state hazard:** `ui_settings` is loaded server-side in the layout, so
`page.route` cannot stub it. A spec needing a particular mode must set it through
the real `/api/ui-settings` endpoint — but that is **shared backend state**, and
clashing writes between concurrent specs cause flakiness. Pin every spec that
touches a given setting to the same value (the toy specs pin both mass modes off
in `beforeEach`) or otherwise serialize them. Never let one spec depend on a
setting being on while a sibling forces it off. Note that pinning leaves the
setting changed in the dev backend after the run.

**Sample data:** the specs assert against the sample data and assume the backend
holds an unmodified copy. Specs mutate state, and a partial or stale import can
leave records that throw off later assertions. If the suite starts failing for
data-related reasons, **delete the database and import a fresh copy of the sample
data** before running again.

Run: `npm run test:e2e` (`npm run test:e2e:ui` for the interactive runner).
Playwright starts the dev server itself, reusing one if already running.
