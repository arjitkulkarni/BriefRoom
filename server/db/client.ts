/**
 * Database connection.
 *  - Neon / any Postgres: node-postgres Pool on the POOLED url (long-running Express server
 *    reusing connections — the driver the Neon skill recommends for this runtime).
 *    Migrations use a separate direct (unpooled) connection.
 *  - No DATABASE_URL (development/test only): embedded PGlite — real Postgres compiled to WASM,
 *    same SQL, same migrations, same transactions. Never used in production.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { schema } from './schema.ts';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Executor = Db | Tx;

export interface DbHandle {
  db: Db;
  kind: 'postgres' | 'pglite';
  migrate: () => Promise<void>;
  pendingMigrations: () => Promise<number>;
  ping: () => Promise<number>;
  close: () => Promise<void>;
}

export const MIGRATIONS_DIR = join(process.cwd(), 'drizzle');

function journalCount(): number {
  const file = join(MIGRATIONS_DIR, 'meta', '_journal.json');
  if (!existsSync(file)) return 0;
  return (JSON.parse(readFileSync(file, 'utf8')).entries ?? []).length;
}

async function appliedCount(db: Db): Promise<number> {
  try {
    const r = await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    const rows = (r as unknown as { rows: { n: number }[] }).rows;
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0; // migrations table does not exist yet
  }
}

async function timedPing(db: Db) {
  const t0 = performance.now();
  await db.execute(sql`select 1`);
  return Math.round(performance.now() - t0);
}

export async function connectPostgres(url: string, migrationUrl: string | null): Promise<DbHandle> {
  const pg = (await import('pg')).default;
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const pool = new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 15_000 });
  pool.on('error', (err) => console.error('[db] idle client error', err.message));
  const db = drizzle(pool, { schema }) as unknown as Db;
  return {
    db,
    kind: 'postgres',
    async migrate() {
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      const client = new pg.Client({ connectionString: migrationUrl ?? url, connectionTimeoutMillis: 15_000 });
      await client.connect();
      try {
        await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_DIR });
      } finally {
        await client.end();
      }
    },
    pendingMigrations: async () => Math.max(0, journalCount() - (await appliedCount(db))),
    ping: () => timedPing(db),
    close: () => pool.end(),
  };
}

export async function connectPglite(dir: string | null): Promise<DbHandle> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const client = dir ? new PGlite(dir) : new PGlite();
  const db = drizzle(client, { schema }) as unknown as Db;
  return {
    db,
    kind: 'pglite',
    async migrate() {
      const { migrate } = await import('drizzle-orm/pglite/migrator');
      await migrate(db as never, { migrationsFolder: MIGRATIONS_DIR });
    },
    pendingMigrations: async () => Math.max(0, journalCount() - (await appliedCount(db))),
    ping: () => timedPing(db),
    close: () => client.close(),
  };
}
