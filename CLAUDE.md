### This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

### Testing

This project uses Jest with React Testing Library for unit tests (config in `jest.config.ts`, tests in `__tests__/`). When writing code, favor testable designs and add Jest unit tests where appropriate — e.g. keep components prop-driven and presentational, isolate logic, and prefer asserting on accessible roles, names, and attributes (like `aria-current`) over CSS-module class names. Note that Jest does not support `async` Server Components; cover those with E2E tests instead. Run tests with `npm test`.

### Inspiration

The files in the design-inspiration directory are for reference only DO NOT try to replicate them in the project.