// The public origin this app is served on — the one the BROWSER used. Every OAuth
// URL that has to round-trip through the user's browser is built from it:
// `redirect_uri` on the authorization request and on the code exchange, the
// post-login landing URL, and `post_logout_redirect_uri`.
//
// Why this is not just `new URL(request.url).origin`: in the production image
// Next runs its standalone server bound to 0.0.0.0:3000, and `request.url` inside
// a Route Handler reports that BIND address rather than the proxied Host. Behind
// the Caddy edge that yields `https://0.0.0.0:3000`, so the app asks Keycloak for
// `redirect_uri=https://0.0.0.0:3000/api/auth/callback`, which is not one of the
// realm's registered URIs — Keycloak answers "Invalid parameter: redirect_uri"
// and login is impossible. Set APP_ORIGIN in any deployment that sits behind a
// reverse proxy; compose.production.yaml wires it from ${APP_DOMAIN}.
//
// Deliberately configuration and NOT the X-Forwarded-Host header. That header is
// attacker-controllable unless the proxy is known to overwrite it, and the
// callback redirects the browser to `new URL(dest, origin)` — trusting a spoofed
// host there is an open redirect. An explicit value cannot be poisoned by a
// request.
//
// When APP_ORIGIN is unset the request's own origin is used, which is correct
// for every non-proxied topology: `npm run dev` on 3000, and the compose stacks
// that publish the frontend directly on 4200. Those keep working with no config.

export function appOrigin(request: Request): string {
  const configured = process.env.APP_ORIGIN?.trim();
  if (!configured) {
    return new URL(request.url).origin;
  }
  try {
    // Normalizes away any path/query/trailing slash, and rejects garbage loudly
    // rather than silently building an unusable redirect_uri.
    return new URL(configured).origin;
  } catch {
    throw new Error(
      `APP_ORIGIN is not a valid absolute URL: "${configured}" (expected e.g. https://pensieve.example.com)`,
    );
  }
}
