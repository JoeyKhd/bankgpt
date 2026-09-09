import type { NextConfig } from "next"
import { withAui } from "@assistant-ui/next"

const nextConfig: NextConfig = {
  // Docker image runs the standalone server (apps/frontend/Dockerfile).
  output: "standalone",
}

export default withAui(nextConfig)
