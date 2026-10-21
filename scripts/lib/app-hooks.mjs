/**
 * Module resolution for tests that run the app's own server code under plain
 * Node, outside Next. Registered by scripts/lib/app-loader.mjs.
 *
 * Three things Next normally provides, and nothing else:
 *
 * - `@/…` resolves into src/, as tsconfig.json says.
 * - Relative imports without an extension find their .ts file, as the bundler
 *   would.
 * - `server-only` is a no-op, and `next/headers` is a cookie jar the test
 *   controls (scripts/lib/next-headers-stub.mjs), so code that reads who is
 *   asking can be asked as anyone.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const src = path.join(root, "src");

/** The file an import means: as written if it has an extension, else the .ts beside it. */
function findSource(base) {
  const candidates = /\.[cm]?[jt]sx?$/.test(base)
    ? [base]
    : [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
  const hit = candidates.find((candidate) => existsSync(candidate));
  return hit ? pathToFileURL(hit).href : null;
}

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export {};", shortCircuit: true };
  }
  if (specifier === "next/headers") {
    return {
      url: pathToFileURL(path.join(root, "scripts/lib/next-headers-stub.mjs")).href,
      shortCircuit: true,
    };
  }
  if (specifier.startsWith("@/")) {
    const url = findSource(path.join(src, specifier.slice(2)));
    if (url) return { url, shortCircuit: true };
  }
  if (specifier.startsWith(".") && context.parentURL?.startsWith(pathToFileURL(src).href)) {
    const url = findSource(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (url) return { url, shortCircuit: true };
  }
  return next(specifier, context);
}
