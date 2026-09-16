import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design references, not ours to lint: the prototype's own runtime ships
    // ReactDOM.render and assigns to `module`. Kept in the repo for the specs
    // they carry, never bundled.
    "design_handoff_wishly/**",
  ]),
]);

export default eslintConfig;
