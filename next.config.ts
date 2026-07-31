import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,

  serverExternalPackages: ["pino"],

  typescript: {
    ignoreBuildErrors: false,
  },

  poweredByHeader: false,

  allowedDevOrigins: ["*.monkeycode-ai.live", "*.monkeycode-ai.com"],
};

export default nextConfig;
