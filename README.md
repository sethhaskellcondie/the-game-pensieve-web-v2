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
   routes are documented by the OpenAPI spec in the backend repository.
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

## Additional Documentation

Check the /documentation directory for more information. Start with /documentation/DevDocumentation.md.
See the package.json file to see what scripts are available.
