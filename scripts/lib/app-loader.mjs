/**
 * `node --import ./scripts/lib/app-loader.mjs some-test.mts` runs a test
 * against the app's own server modules. See app-hooks.mjs.
 */
import { register } from "node:module";

register("./app-hooks.mjs", import.meta.url);
