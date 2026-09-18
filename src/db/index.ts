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
 * Whether this process is `next build` rather than a running server.
 *
 * A build imports every module that a page reaches, in one worker process per
 * core, purely to collect its configuration — and this module opens a database
 * as a side effect of being imported. Nothing in a build ever queries, so the
 * rule throughout this file is: while building, touch the file as little as
 * possible. See `migrateIfAsked` and the journal mode in `connect`.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

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
  if (isBuildPhase) return;

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

  // Wait rather than throwing SQLITE_BUSY if a write is in flight. Set first so
  // everything below it is covered; a timeout declared afterwards does nothing
  // for the statements that already ran.
  sqlite.pragma("busy_timeout = 5000");

  /*
   * WAL lets readers continue during a write; needed once several guests are
   * claiming at once.
   *
   * Skipped while building, and that is not an optimisation. The journal mode
   * belongs to the file rather than to this connection, so switching it takes a
   * brief exclusive lock — and `next build` imports this module in every
   * page-data worker at once, one per core. On a machine with enough of them
   * they contend, and the losers throw SQLITE_BUSY: "Failed to collect
   * configuration for /_not-found", with `database is locked` underneath it.
   *
   * The busy timeout above does not save this; the pragma gives up rather than
   * waiting. Not asking for it during a build does, and costs nothing, because
   * a build never reads or writes a row. The server that starts afterwards sets
   * it for real.
   */
  if (!isBuildPhase) sqlite.pragma("journal_mode = WAL");

  // SQLite leaves foreign keys off by default; our cascades depend on them.
  sqlite.pragma("foreign_keys = ON");

  migrateIfAsked(sqlite);
  return sqlite;
}

export const db = drizzle((globalForDb.__sqlite ??= connect()), { schema });
export { schema };
