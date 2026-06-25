# syntax=docker/dockerfile:1

# Multi-stage build for the Next.js (React) frontend.

# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Install all dependencies (including devDependencies needed to build).
COPY package*.json ./
RUN npm ci

# Copy source and build. `output: "standalone"` in next.config.ts produces a
# self-contained server under .next/standalone with only the traced runtime deps.
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Bind to all interfaces so the server is reachable from outside the container.
ENV HOSTNAME=0.0.0.0

# Copy the standalone server, static assets, and public files from the build stage.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000

# API_BASE_URL (server-only, including the /v1 prefix) must be supplied at runtime,
# e.g. via the compose file. See .env.example for the variables this app expects.
CMD ["node", "server.js"]
