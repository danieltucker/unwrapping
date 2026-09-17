import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module: it must stay external to the server
  // bundle rather than being traced and rewritten by the bundler.
  serverExternalPackages: ["better-sqlite3"],

  // Emits .next/standalone: the server plus only the node_modules it actually
  // uses, so the Docker image needs no npm install. See docs/self-hosting.md.
  output: "standalone",

  outputFileTracingIncludes: {
    // The migrations are read from disk at runtime (src/db/index.ts), which
    // static analysis cannot see, so they have to be named here or a container
    // starts against an empty database.
    "/**/*": ["./drizzle/**/*.sql", "./drizzle/meta/**/*.json"],
  },
};

export default nextConfig;
