import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel-friendly defaults */
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/goldprism/bhavcopy": [
      "./research/data/incoming/BhavCopyDateWise_20112026.csv",
    ],
  },
  allowedDevOrigins: ["*.run.app", "*.aistudio.google.com"],
};

export default nextConfig;
