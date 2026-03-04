import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "@resvg/resvg-js"],
};

export default nextConfig;
