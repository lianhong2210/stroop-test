import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build a fully static site into `out/` (HTML, CSS, JS, icons). The game
  // runs entirely in the browser, so it can be hosted on any static host,
  // e.g. Cloudflare Pages with build output directory `out`.
  output: "export",
  // Hide the floating Next.js badge in development; errors still surface.
  devIndicators: false,
  // Let phones/tablets on the local network load the dev server
  // (e.g. http://192.168.0.15:3000). Without this, Next.js blocks the dev
  // scripts for any host but localhost, so the page renders but never
  // becomes interactive. Development only: production builds ignore it.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
};

export default nextConfig;
