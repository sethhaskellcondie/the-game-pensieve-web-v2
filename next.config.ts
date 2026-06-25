import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Emit a self-contained server bundle (.next/standalone) so the Docker image
  // can run `node server.js` with only the traced runtime dependencies.
  output: "standalone",
};

export default nextConfig;
