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

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The page reloads automatically as you edit files.

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

## Available scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start the development server with hot reloading. |
| `npm run build` | Produce an optimized production build in `.next/`. |
| `npm run start` | Serve the production build (run `npm run build` first). |
| `npm run lint` | Run ESLint across the project. |

## Project structure

```
src/            Application source code
public/         Static assets served as-is
next.config.ts  Next.js configuration
tsconfig.json   TypeScript configuration (path alias: @/* -> ./src/*)
eslint.config.mjs  ESLint configuration
```
