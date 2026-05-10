/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH !== undefined
  ? process.env.NEXT_PUBLIC_BASE_PATH
  : "/uk/spring-statement-2026";

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  output: "export",
  trailingSlash: true,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  // Pin the workspace root so Turbopack does not pick up a stray lockfile from
  // a parent directory (saw this with /tmp/bun.lock during local builds).
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
