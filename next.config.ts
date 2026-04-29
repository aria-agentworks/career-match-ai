import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone" — removed, let Vercel manage output
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
