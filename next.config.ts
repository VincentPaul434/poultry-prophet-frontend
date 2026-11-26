import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The development badge otherwise overlaps the mobile bottom navigation.
  // Build and runtime errors are still shown by Next.js.
  devIndicators: false,
  // Pin the workspace root: a parent directory has its own lockfile, which would
  // otherwise make Next.js guess the wrong root.
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    // React's development debug channel uses the HMR connection to decode
    // the initial page. Keep offline development pages able to hydrate when
    // that WebSocket is unreachable; production builds do not use it.
    reactDebugChannel: false,
    // Next 16 defaults to invoking `tsc` in a child process. In this workspace,
    // that process returns an empty `--showConfig` response even though the
    // TypeScript API and direct compiler check succeed. Use the supported API
    // path so production builds can type-check reliably.
    useTypeScriptCli: false,
    // Reduce the initial development-server footprint. Routes can still be
    // compiled lazily when opened.
    preloadEntriesOnStart: false,
    // Applies to the explicit Webpack development fallback only.
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
