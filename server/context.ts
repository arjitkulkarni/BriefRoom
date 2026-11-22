/**
 * Composition root: wires config → database → storage → Nexconn → domain → outbox.
 * Used by the HTTP server and by the integration tests (with PGlite and fakes).
 */
import type { AppConfig } from './config.ts';
import type { DbHandle } from './db/client.ts';
import { createCommands } from './domain/commands.ts';
import { createDemoService } from './domain/demo.ts';
import { createBriefService } from './domain/service.ts';
import { createAssetSigner } from './domain/util.ts';
import { createNexconnClient, type NexconnServerApi } from './nexconn/client.ts';
import { createChannelManager, createOutbox } from './nexconn/outbox.ts';
import { createStorage, type ImageStorageProvider } from './storage/provider.ts';

export function createContext(config: AppConfig, dbh: DbHandle, overrides: { nexconn?: NexconnServerApi; storage?: ImageStorageProvider; autoDispatch?: boolean } = {}) {
  const nexconn = overrides.nexconn ?? createNexconnClient(config.nexconn);
  const storage = overrides.storage ?? createStorage(config);
  const signer = createAssetSigner(config.sessionSecret);
  // The outbox needs the token cache owned by the core service; wire it lazily via a holder.
  const holder: { kick: () => void } = { kick: () => undefined };
  const core = createBriefService({ db: dbh.db, storage, signer, config, nexconn, onCommit: () => holder.kick() });
  const commands = createCommands(core);
  const channels = createChannelManager(dbh.db, nexconn, core.tokenCache);
  const outbox = createOutbox(dbh.db, nexconn, channels);
  if (overrides.autoDispatch !== false) holder.kick = outbox.kick;
  // Ready-made live demos (seeding one takes many round trips). Filled only after `demo.start()`.
  const defaultPool = config.env === 'production' ? 2 : config.env === 'development' ? 1 : 0;
  const poolSize = Math.max(0, Math.min(5, Number(process.env.DEMO_POOL_SIZE ?? defaultPool) || 0));
  const demo = createDemoService({ db: dbh.db, core, commands, nexconn, channels }, { poolSize });
  return { config, dbh, core, commands, channels, outbox, nexconn, storage, demo, startedAt: Date.now() };
}
