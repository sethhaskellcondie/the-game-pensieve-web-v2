// Runs once when the server starts. Installs the cookie-aware bearer-token
// resolver into the shared data client so server-side backend calls (server
// components + route handlers) carry the logged-in user's token. Guarded to the
// Node runtime and dynamically imported so the server-only session code is never
// pulled into the Edge/browser bundles.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail fast on a misconfigured production deployment. resolveSessionSecret()
    // throws when NODE_ENV=production and SESSION_SECRET is missing or shorter
    // than iron-session's 32-character floor; checking here means the server
    // dies on boot with a message naming the variable, instead of booting
    // healthy and failing at whatever moment the first user tries to log in.
    // This hook runs at server start only, never during `next build`.
    //
    // The exit is explicit because throwing is not enough: Next catches a
    // failing instrumentation hook, logs "Failed to prepare server", and leaves
    // the process alive. That container would sit there reporting `running`
    // forever, serving nothing — the exact silent-failure shape this guard
    // exists to eliminate. Exiting non-zero makes `restart: unless-stopped`
    // surface it as a visible crash loop.
    try {
      const { resolveSessionSecret } = await import("./lib/sessionConfig");
      resolveSessionSecret();
    } catch (error) {
      console.error(
        `Refusing to start: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }

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
