import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas"],
  // 確保字型檔案被打包進 Vercel serverless function bundle
  outputFileTracingIncludes: {
    "**": ["./public/fonts/**"],
  },
};

export default nextConfig;
