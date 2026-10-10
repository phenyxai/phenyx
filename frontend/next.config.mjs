/**
 * Old dashboard paths kept alive for bookmarks (PHE-96): daily was removed and
 * the you tab became insights. Mirrors LEGACY_REDIRECTS in lib/dashboard-nav.ts;
 * lib/dashboard-nav.test.ts fails if the two drift.
 */
const LEGACY_REDIRECTS = [
  { source: '/dashboard/daily', destination: '/dashboard/constellation' },
  { source: '/dashboard/you', destination: '/dashboard/insights' },
  { source: '/dashboard/profile', destination: '/dashboard/insights' },
  { source: '/daily', destination: '/dashboard/constellation' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ['onairos'],
  async redirects() {
    return LEGACY_REDIRECTS.flatMap(({ source, destination }) => [
      { source, destination, permanent: false },
      { source: `${source}/:path*`, destination, permanent: false },
    ])
  },
}

export default nextConfig
