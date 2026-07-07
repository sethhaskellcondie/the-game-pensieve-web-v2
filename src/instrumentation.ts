// Runs once when the server starts. Installs the cookie-aware bearer-token
// resolver into the shared data client so server-side backend calls (server
// components + route handlers) carry the logged-in user's token. Guarded to the
// Node runtime and dynamically imported so the server-only session code is never
// pulled into the Edge/browser bundles.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const {
      installServerTokenResolver,
      installServerActAsResolver,
      installServerShowcaseResolver,
    } = await import("./lib/serverAuth");
    installServerTokenResolver();
    // Also attach the admin-impersonation header from the session, so acting as
    // a user flows through every server-side backend call automatically.
    installServerActAsResolver();
    // And the X-Showcase header from the gp_showcase cookie, so viewing a
    // public showcase scopes every showcase-scoped (collection data) call.
    installServerShowcaseResolver();
  }
}
