import type { NextConfig } from "next"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = fileURLToPath(new URL(".", import.meta.url))
const workspaceRoot = path.resolve(appRoot, "..")
const require = createRequire(import.meta.url)
const pgEntry = require.resolve("pg", {
  paths: [appRoot],
})

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  webpack: (config) => {
    config.resolve ??= {}
    config.resolve.alias ??= {}
    config.resolve.modules = [
      path.join(appRoot, "node_modules"),
      ...(config.resolve.modules ?? []),
    ]
    config.resolve.alias.pg = pgEntry

    return config
  },
}

export default nextConfig
