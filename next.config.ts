import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep data/*.json in serverless bundles if anything still reads via fs.
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/**/*.json"],
  },
};

export default nextConfig;
