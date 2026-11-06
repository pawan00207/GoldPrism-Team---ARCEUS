import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel-friendly defaults */
  reactStrictMode: true,
  output: "standalone",
  allowedDevOrigins: ["*.run.app", "*.aistudio.google.com"],
};

export default nextConfig;
