import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep this nested app isolated from the legacy dashboard above it.
    root: process.cwd(),
  },
};

export default nextConfig;
