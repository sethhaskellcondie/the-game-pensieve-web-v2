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
