/**
 * Vercel entry point: the same Express app as server/index.ts, run as one serverless function.
 * Bundled by `npm run build:api` into api/_server.mjs; api/index.mjs re-exports it.
 *
 * Differences from the long-running server:
 *  - No interval timer: a serverless instance is frozen between requests. After every request that
 *    may have written domain events, the Nexconn outbox is drained inside `waitUntil`, so the order's
 *    group channel still gets its messages (and earlier failures are retried on the next write).
 *  - Migrations run at build time (`vercel.json` buildCommand), never on a request.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { waitUntil } from '@vercel/functions';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { connectPostgres } from './db/client.ts';
import { createContext } from './context.ts';

type Ctx = ReturnType<typeof createContext>;
type App = ReturnType<typeof createApp>;

let booting: Promise<{ ctx: Ctx; app: App }> | null = null;

async function boot() {
  const { config, errors, warnings } = loadConfig();
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (errors.length) throw new Error(`BriefRoom is misconfigured: ${errors.join(' ')}`);
  if (!config.database.url) throw new Error('DATABASE_URL is required on Vercel (the embedded dev database cannot run here).');
  const dbh = await connectPostgres(config.database.url, config.database.migrationUrl);
  // Dispatch is driven explicitly below, so a request never returns before its events are queued for delivery.
  const ctx = createContext(config, dbh, { autoDispatch: false });
  return { ctx, app: createApp(ctx) };
}

let lastDrain = 0;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  let booted: { ctx: Ctx; app: App };
  try {
    booted = await (booting ??= boot().catch((e) => ((booting = null), Promise.reject(e))));
  } catch (e) {
    console.error('[boot]', (e as Error).message);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'BriefRoom is starting up or misconfigured. Please try again in a moment.' }));
    return;
  }
  const { ctx, app } = booted;
  await new Promise<void>((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    app(req as Parameters<App>[0], res as Parameters<App>[1]);
  });
  // Writes always drain; reads drain at most every 10 s, which retries anything left pending.
  const now = Date.now();
  if (req.method !== 'GET' || now - lastDrain > 10_000) {
    lastDrain = now;
    waitUntil(ctx.outbox.runOnce().catch((e) => console.error('[outbox]', (e as Error).message)));
  }
  // No warm pool here (nothing runs between requests): /api/demo seeds on demand and finishes the
  // dashboard orders and chat lines after responding. Keep the instance alive until that is done;
  // the chat lines wait for the outbox, so drain once more when they are ready to go.
  if (req.method === 'POST' && req.url?.startsWith('/api/demo')) {
    waitUntil(
      ctx.demo
        .idle()
        .then(() => ctx.outbox.runOnce())
        .catch((e) => console.error('[demo]', (e as Error).message)),
    );
  }
}
