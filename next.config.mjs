/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so the whole site can be served as plain files (Vercel, or any static host).
  output: "export",
  images: { unoptimized: true },
  // Emit /path/index.html instead of /path.html so links work on any static host.
  trailingSlash: true,
  // A verification build can be pointed at its own directory so it doesn't wipe
  // the chunks a running `next dev` is serving from `.next/`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
