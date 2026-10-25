/**
 * The database: Postgres at DATABASE_URL (.env), queried through Drizzle (tables in schema.ts). In dev that's the
 * Docker container from compose.yaml (`npm run db:up`, which `npm run dev` runs first).
 */
import { join } from "node:path";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { DATABASE_URL, DEV } from "../env.js";

/** `$client` is the pool, for closing it (the seed script). */
export type Db = NodePgDatabase & { $client: Pool };

/**
 * Connects and applies the migrations in migrations/ that this database hasn't run yet (Drizzle records them in
 * `drizzle.__drizzle_migrations`). Throws a readable message if Postgres isn't reachable or a migration fails.
 */
export async function connectDb(): Promise<Db> {
  const url = DATABASE_URL;
  if (!url) {
    throw new Error(`DATABASE_URL isn't set.${DEV ? " Copy .env.example to .env (`npm run db:up` does it)." : ""}`);
  }
  const pool = new Pool({ connectionString: url });
  // Postgres restarting drops idle connections; without a listener that error would crash the server.
  pool.on("error", (err) => console.error("[db] lost an idle connection:", err.message));
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    await pool.end();
    const hint = DEV
      ? " Is Docker running and the database up (`npm run db:up`)? Does DATABASE_URL in .env match its POSTGRES_* lines?"
      : "";
    throw new Error(`can't reach Postgres at ${hidePassword(url)} (${errorText(err)}).${hint}`, { cause: err });
  }
  const db = drizzle({ client: pool });
  try {
    await migrate(db, { migrationsFolder: join(import.meta.dirname, "migrations") });
  } catch (err) {
    await pool.end();
    // Drizzle wraps Postgres' error in one that quotes the whole migration; the reason is in `cause`.
    const pgError = err instanceof Error && err.cause ? err.cause : err;
    const hint = DEV ? " If this database was made by another branch, `npm run db:reset` starts it over." : "";
    throw new Error(`a migration failed (${errorText(pgError)}).${hint}`, { cause: err });
  }
  return db;
}

const hidePassword = (url: string) => url.replace(/\/\/([^:@/]+):[^@/]*@/, "//$1:***@");

/** The most readable line an error (or a thrown non-Error, or a Postgres error without a message) has. */
export function errorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return (err as { code?: string } | null)?.code ?? String(err);
}
