import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root: a parent directory has its own lockfile, which would
  // otherwise make Next.js guess the wrong root.
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    // Reduce the initial development-server footprint. Routes can still be
    // compiled lazily when opened.
    preloadEntriesOnStart: false,
    // Applies to the explicit Webpack development fallback only.
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
