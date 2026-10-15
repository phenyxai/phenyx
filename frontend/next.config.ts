import type { NextConfig } from "next";
import { LEGACY_REDIRECTS } from "./lib/dashboard-nav";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["onairos"],
  // Old dashboard paths kept alive for bookmarks (PHE-96). `:path*` also
  // matches zero segments, so one rule covers a route and everything under it.
  async redirects() {
    return LEGACY_REDIRECTS.map(({ source, destination }) => ({
      source: `${source}/:path*`,
      destination,
      permanent: false,
    }));
  },
};

export default nextConfig;
