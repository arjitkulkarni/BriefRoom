/**
 * BriefRoom API server entry point.
 *   npm run dev:api   (tsx watch, loads .env then .env.local)
 *   npm start         (production)
 */
import { createApp } from './app.ts';
import { describeConfig, loadConfig } from './config.ts';
import { connectPglite, connectPostgres } from './db/client.ts';
import { createContext } from './context.ts';

const { config, errors, warnings } = loadConfig();
for (const w of warnings) console.warn(`  ! ${w}`);
if (errors.length) {
  console.error('\nBriefRoom cannot start — fix these environment settings (see .env.example and docs/CONFIGURATION.md):\n');
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('');
  process.exit(1);
}

const dbh = config.database.url ? await connectPostgres(config.database.url, config.database.migrationUrl) : await connectPglite(config.database.embeddedDir);

try {
  if (dbh.kind === 'pglite') {
    await dbh.migrate(); // embedded dev database: always kept current
  } else {
    const pending = await dbh.pendingMigrations();
    if (pending > 0) {
      console.error(`\n  ✗ ${pending} database migration(s) are pending. Run \`npm run db:migrate\` (uses DATABASE_URL_UNPOOLED), then start again.\n`);
      process.exit(1);
    }
  }
} catch (err) {
  console.error('\n  ✗ Could not reach the database:', (err as Error).message, '\n');
  process.exit(1);
}

const ctx = createContext(config, dbh);
const app = createApp(ctx);
ctx.outbox.start();
ctx.outbox.kick(); // deliver anything left pending by a previous run

const server = app.listen(config.port, () => {
  console.log(`\nBriefRoom API listening on http://localhost:${config.port}`);
  for (const line of describeConfig(config)) console.log(`  · ${line}`);
  console.log('');
});

async function shutdown(signal: string) {
  console.log(`[${signal}] shutting down…`);
  ctx.outbox.stop();
  server.close();
  await dbh.close().catch(() => undefined);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
