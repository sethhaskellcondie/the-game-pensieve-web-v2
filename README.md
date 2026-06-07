# the-game-pensieve-web-v2

The second iteration of the game pensieve web front end.

Built with [Next.js](https://nextjs.org/) 16, [React](https://react.dev/) 19, and TypeScript.

## Prerequisites

You need the following installed before building the project:

| Tool | Version | Notes |
| ---- | ------- | ----- |
| [Node.js](https://nodejs.org/) | 20.x or newer | Ships with `npm`. Verified on Node 26 / npm 11. |
| npm | 10.x or newer | Installed alongside Node.js. |
| git | any recent | To clone the repository. |

Check what you have:

```bash
node --version
npm --version
git --version
```

If you need to manage multiple Node versions, [nvm](https://github.com/nvm-sh/nvm) is recommended:

```bash
nvm install 20
nvm use 20
```

## Build from scratch

### 1. Clone the repository

### 2. Install dependencies

This installs both runtime and development dependencies listed in `package.json`:

```bash
npm install
```

Key dependencies that get installed:

**Runtime**
- `next@16.2.7` — the framework / build tool
- `react@19.2.4` and `react-dom@19.2.4` — the UI library

**Development**
- `typescript@^5` — TypeScript compiler
- `@types/node@^20`, `@types/react@^19`, `@types/react-dom@^19` — type definitions
- `eslint@^9` and `eslint-config-next@16.2.7` — linting
- `babel-plugin-react-compiler@1.0.0` — the React Compiler
- `jest@^30`, `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/jest-dom` — unit / component testing
- `@playwright/test@^1.60` — End-to-End (E2E) testing

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The page reloads automatically as you edit files.

To load real data, the [backend API](#backend-api-development) must also be running — see below.

### 4. Create a production build

```bash
npm run build
```

This compiles and optimizes the app into the `.next/` directory.

### 5. Run the production server

After building, serve the optimized app:

```bash
npm run start
```

## Backend API (development)

The app fetches its data from the Game Pensieve backend API. During development the
backend must be running locally and reachable at **`http://localhost:8080/v1`**.

1. Start the backend server so its API is served under `http://localhost:8080/v1`
   (refer to the backend project for its own run instructions). The available
   routes are documented in [`backend-documentation/openapi.yaml`](backend-documentation/openapi.yaml).
2. The frontend reads this URL from the `API_BASE_URL` environment variable, which
   is preset for local development in [`.env.development`](.env.development):

   ```bash
   API_BASE_URL=http://localhost:8080/v1
   ```

   No setup is needed for the default localhost workflow. To point at a different
   backend, override `API_BASE_URL` in a `.env.local` file (gitignored).
3. Verify the connection once the backend is up:

   ```bash
   curl http://localhost:8080/v1/heartbeat
   ```

> **Production:** `API_BASE_URL` must be set to the deployed API URL via the host's
> environment (or `.env.production`). The app intentionally throws at runtime if the
> variable is missing outside of development.

## Testing

This project has two test suites:

- **Unit / component tests** — [Jest](https://jestjs.io/) + [React Testing Library](https://testing-library.com/), in `__tests__/`.
- **End-to-End (E2E) tests** — [Playwright](https://playwright.dev/), in `e2e/`.

```bash
# Unit / component tests (Jest)
npm test               # run once
npm run test:watch     # re-run on file changes

# End-to-end tests (Playwright)
npm run test:e2e       # run headless across Chromium, Firefox, and WebKit
npm run test:e2e:ui    # run in Playwright's interactive UI mode
```

Playwright automatically starts the Next.js dev server before running, so you don't
need `npm run dev` running separately. The first time you run E2E tests, install the
browser binaries once:

```bash
npx playwright install
```

## Available scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start the development server with hot reloading. |
| `npm run build` | Produce an optimized production build in `.next/`. |
| `npm run start` | Serve the production build (run `npm run build` first). |
| `npm run lint` | Run ESLint across the project. |
| `npm test` | Run the Jest unit / component test suite once. |
| `npm run test:watch` | Run Jest in watch mode, re-running on changes. |
| `npm run test:e2e` | Run the Playwright E2E test suite (headless). |
| `npm run test:e2e:ui` | Run the Playwright E2E tests in interactive UI mode. |

## Project structure

```
src/            Application source code (src/lib/api.ts wraps the backend API)
public/         Static assets served as-is
__tests__/      Jest unit / component tests
e2e/            Playwright end-to-end tests
backend-documentation/  Backend API reference (OpenAPI spec, Postman collection)
next.config.ts  Next.js configuration
tsconfig.json   TypeScript configuration (path alias: @/* -> ./src/*)
jest.config.ts  Jest configuration
playwright.config.ts  Playwright configuration
eslint.config.mjs  ESLint configuration
```
