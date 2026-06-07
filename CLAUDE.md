### This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

### Testing

This project uses Jest with React Testing Library for unit tests (config in `jest.config.ts`, tests in `__tests__/`). When writing code, favor testable designs and add Jest unit tests where appropriate — e.g. keep components prop-driven and presentational, isolate logic, and prefer asserting on accessible roles, names, and attributes (like `aria-current`) over CSS-module class names. Note that Jest does not support `async` Server Components; cover those with E2E tests instead. Run tests with `npm test`.

Playwright handles End-to-End (E2E) tests (config in `playwright.config.ts`, specs in `e2e/` as `*.spec.ts`). When building user-facing flows — navigation, forms, multi-step interactions, and `async` Server Components — favor designs that are E2E-testable and add Playwright specs where appropriate. Make UI reachable and assertable through accessible, stable selectors: use semantic elements and ARIA roles/names, expose state via attributes (e.g. `aria-current`), give pages real headings, and use stable URLs/routes. Reserve `data-testid` for cases where no accessible selector fits. Keep E2E specs in `e2e/` (Jest is configured to ignore that directory) and run them with `npm run test:e2e`.

### Backend

The `backend-documentation/` directory holds the reference notes for how to connect to the backend API to retrieve data — consult it before writing any data-fetching or API-integration code. It contains `openapi.yaml` (the OpenAPI 3.0 spec: endpoints, request/response shapes, and the standard `{ "data": ..., "errors": ... }` response envelope) and `api.postman_collection.json` (a Postman collection of example requests). These are reference material describing the existing backend — do not edit them to change the API; follow what they document.

### Inspiration

The files in the design-inspiration directory are for reference only DO NOT try to replicate them in the project.