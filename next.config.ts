import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module: it must stay external to the server
  // bundle rather than being traced and rewritten by the bundler.
  serverExternalPackages: ["better-sqlite3"],

  // Emits .next/standalone: the server plus only the node_modules it actually
  // uses, so the Docker image needs no npm install. See docs/self-hosting.md.
  output: "standalone",

  experimental: {
    serverActions: {
      // Gift photos are uploaded through a Server Action, and the default cap
      // on an action's request body is 1MB — less than an ordinary phone photo,
      // so the request died in the framework before any of our code ran and the
      // owner got a bare 500 page. This sits above `uploads.maxBytes` in
      // src/config/site.ts (8MB), with room for what multipart adds, so the
      // file that is too big is the one we refuse ourselves, with a sentence.
      bodySizeLimit: "9mb",
    },
  },

  outputFileTracingIncludes: {
    // The migrations are read from disk at runtime (src/db/index.ts), which
    // static analysis cannot see, so they have to be named here or a container
    // starts against an empty database.
    "/**/*": ["./drizzle/**/*.sql", "./drizzle/meta/**/*.json"],
  },
};

export default nextConfig;
