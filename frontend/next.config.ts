import path from "node:path";
import type { NextConfig } from "next";

// Uploaded media are served by Laravel (`{APP_URL}/storage/...`); next/image may only optimise those.
const apiUrl = new URL(process.env.API_URL ?? "http://127.0.0.1:8100/api/v1");
const apiIsLocal = ["localhost", "127.0.0.1", "[::1]"].includes(apiUrl.hostname);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: "/storage/**",
      },
    ],
    // The optimiser refuses private IPs by default (SSRF guard). Only the local dev API needs it.
    dangerouslyAllowLocalIP: apiIsLocal,
  },
  turbopack: {
    // The repo root has its own package-lock.json (dev scripts); pin the app root explicitly.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
