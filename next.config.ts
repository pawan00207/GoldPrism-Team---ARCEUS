import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel-friendly defaults */
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/**/*": ["./research/data/verified/*.json", "./results/mcx-live-snapshot.json"],
  },
  allowedDevOrigins: ["*.run.app", "*.aistudio.google.com"],
};

export default nextConfig;
