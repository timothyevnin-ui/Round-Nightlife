import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Back-office photo uploads travel inside a server action. Phones are
  // shrunk to ~1600px before sending, but leave headroom for the odd big one.
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
