import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "1";
const assetVersion = (
  process.env.VERCEL_GIT_COMMIT_SHA
  ?? process.env.GITHUB_SHA
  ?? "local"
).slice(0, 12);

const nextConfig: NextConfig = {
  ...(isGitHubPages
    ? {
        output: "export" as const,
        assetPrefix: "/bacteria",
        trailingSlash: true,
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: isGitHubPages ? "/bacteria" : "",
    NEXT_PUBLIC_ASSET_VERSION: assetVersion,
  },
};

export default nextConfig;
