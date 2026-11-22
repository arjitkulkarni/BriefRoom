/**
 * `npm run db:migrate` — apply versioned SQL migrations from ./drizzle.
 * Uses DATABASE_URL_UNPOOLED (direct connection) when set, as Neon recommends for migrations.
 * Migrations are additive; nothing here drops or rewrites existing data.
 */
import { loadConfig } from '../config.ts';
import { connectPglite, connectPostgres } from './client.ts';

const { config } = loadConfig();
const target = config.database.url;
if (!target && process.env.VERCEL) {
  // A Vercel build without database settings: nothing to migrate (the API reports itself misconfigured).
  console.warn('[migrate] skipped: DATABASE_URL is not set for this Vercel build');
  process.exit(0);
}
const handle = target ? await connectPostgres(target, config.database.migrationUrl) : await connectPglite(config.database.embeddedDir);
const where = target ? new URL(config.database.migrationUrl ?? target).host : `PGlite ${config.database.embeddedDir}`;

try {
  const before = await handle.pendingMigrations();
  console.log(`[migrate] target: ${where} · pending migrations: ${before}`);
  await handle.migrate();
  const after = await handle.pendingMigrations();
  console.log(`[migrate] done · applied ${before - after} · pending now ${after}`);
} catch (err) {
  console.error('[migrate] FAILED:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await handle.close();
}
