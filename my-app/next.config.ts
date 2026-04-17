import type { NextConfig } from "next"
import path from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = fileURLToPath(new URL(".", import.meta.url))
const workspaceRoot = path.resolve(appRoot, "..")

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
}

export default nextConfig
