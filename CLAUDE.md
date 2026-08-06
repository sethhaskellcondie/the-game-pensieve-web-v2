### This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

### Testing

This project uses Jest with React Testing Library for unit tests (config in `jest.config.ts`, tests in `__tests__/`). When writing code, favor testable designs and add Jest unit tests where appropriate — e.g. keep components prop-driven and presentational, isolate logic, and prefer asserting on accessible roles, names, and attributes (like `aria-current`) over CSS-module class names. Note that Jest does not support `async` Server Components; cover those with E2E tests instead. Run tests with `npm test`.

Playwright handles End-to-End (E2E) tests (config in `playwright.config.ts`, specs in `e2e/` as `*.spec.ts`). When building user-facing flows — navigation, forms, multi-step interactions, and `async` Server Components — favor designs that are E2E-testable and add Playwright specs where appropriate. Make UI reachable and assertable through accessible, stable selectors: use semantic elements and ARIA roles/names, expose state via attributes (e.g. `aria-current`), give pages real headings, and use stable URLs/routes. Reserve `data-testid` for cases where no accessible selector fits. Keep E2E specs in `e2e/` (Jest is configured to ignore that directory) and run them with `npm run test:e2e`.

The UI settings (`ui_settings` — e.g. `massInputMode`, `massEditMode`) are loaded server-side in the layout, so `page.route` cannot stub them; a spec that needs a particular mode must set it through the real `/api/ui-settings` endpoint (GET to read, POST to write). Tests are free to update `ui_settings` this way, but it is **shared backend state** — clashing writes between concurrently running tests cause flakiness. So run such tests in a fashion where their settings will not collide: pin every spec that touches a given setting to the same value (the toys specs pin both mass modes off in `beforeEach`), or otherwise serialize/isolate them. Avoid having one test depend on a setting being on while a sibling forces it off. Note that pinning leaves the setting changed in the dev backend after the run.

## localFiles

All files in this directory are temporary files, the should be referenced when appropriate, but do not write comments that reference these files.