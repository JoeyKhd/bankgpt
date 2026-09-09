import type { NextConfig } from "next"
import { createMDX } from "fumadocs-mdx/next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Docker image runs the standalone server (apps/docs/Dockerfile).
  output: "standalone",
}

const withMDX = createMDX()

export default withMDX(nextConfig)
