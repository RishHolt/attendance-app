import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/login", destination: "/auth/login" },
    ]
  },
}

export default nextConfig
