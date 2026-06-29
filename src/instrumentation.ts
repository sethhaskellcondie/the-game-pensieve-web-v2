// Runs once when the server starts. Installs the cookie-aware bearer-token
// resolver into the shared data client so server-side backend calls (server
// components + route handlers) carry the logged-in user's token. Guarded to the
// Node runtime and dynamically imported so the server-only session code is never
// pulled into the Edge/browser bundles.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installServerTokenResolver } = await import("./lib/serverAuth");
    installServerTokenResolver();
  }
}
