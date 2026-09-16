import "server-only";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

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

function connect() {
  const sqlite = new Database(file);
  // WAL lets readers continue during a write; needed once several guests
  // are claiming at once.
  sqlite.pragma("journal_mode = WAL");
  // SQLite leaves foreign keys off by default; our cascades depend on them.
  sqlite.pragma("foreign_keys = ON");
  // Wait rather than throwing SQLITE_BUSY if a write is in flight.
  sqlite.pragma("busy_timeout = 5000");
  return sqlite;
}

export const db = drizzle((globalForDb.__sqlite ??= connect()), { schema });
export { schema };
