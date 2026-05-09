/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Pin the workspace root so Turbopack does not pick up a stray lockfile from
  // a parent directory (saw this with /tmp/bun.lock during local builds).
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
