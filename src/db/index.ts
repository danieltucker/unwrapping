import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

// DATABASE_URL is a file: URL for parity with a future Postgres move.
const file = (process.env.DATABASE_URL ?? "file:./data/app.db").replace(
  /^file:/,
  "",
);

// Next's dev server re-evaluates modules on edit; keep one connection per
// process so hot reloads don't pile up open handles on the database file.
const globalForDb = globalThis as unknown as {
  __sqlite?: Database.Database;
};

/**
 * Applies any pending migration before the first query.
 *
 * On by default in production and off in development, where the explicit
 * `npm run db:migrate` is part of the workflow and a schema change should fail
 * loudly rather than quietly land. A deployed container has no drizzle-kit (it
 * is a devDependency) and nobody to run it, so this is how a self-hosted
 * instance survives an upgrade. `DB_AUTO_MIGRATE=0` opts out.
 *
 * The migrator is synchronous, like the driver, so the database is ready before
 * this module finishes evaluating.
 */
function migrateIfAsked(sqlite: Database.Database) {
  // `next build` evaluates these modules with NODE_ENV=production while
  // collecting page data. Migrating somebody's live database as a side effect of
  // a build is not what any of this is for.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const asked =
    process.env.DB_AUTO_MIGRATE === "1" ||
    (process.env.NODE_ENV === "production" && process.env.DB_AUTO_MIGRATE !== "0");
  if (!asked) return;

  migrate(drizzle(sqlite), {
    // Resolved from the working directory, which is the project root under
    // `next start` and the app root inside the container. The folder reaches a
    // standalone build through outputFileTracingIncludes; see next.config.ts.
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
}

function connect() {
  // better-sqlite3 creates the file but not its directory, and the directory is
  // a mounted volume that may be empty on a first run.
  mkdirSync(path.dirname(path.resolve(file)), { recursive: true });

  const sqlite = new Database(file);
  // WAL lets readers continue during a write; needed once several guests
  // are claiming at once.
  sqlite.pragma("journal_mode = WAL");
  // SQLite leaves foreign keys off by default; our cascades depend on them.
  sqlite.pragma("foreign_keys = ON");
  // Wait rather than throwing SQLITE_BUSY if a write is in flight.
  sqlite.pragma("busy_timeout = 5000");

  migrateIfAsked(sqlite);
  return sqlite;
}

export const db = drizzle((globalForDb.__sqlite ??= connect()), { schema });
export { schema };
