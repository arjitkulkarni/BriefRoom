import { readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * E2E runs the BUILT app (`npm run test:e2e` builds first). Three modes:
 *  - default: throwaway PGlite database + local disk storage, Nexconn off — never touches Neon.
 *  - E2E_NEXCONN=1: same, plus the NEXCONN_* settings from .env.local (real Nexconn, local data).
 *  - E2E_ENV_FILE=.env.local: the services configured in that file — Neon Postgres (use a dev
 *    branch!), Neon Object Storage and Nexconn. AI is pinned to rules so runs stay deterministic.
 * The live Nexconn spec (e2e/nexconn-live.spec.ts) skips itself unless the server has Nexconn keys.
 */
const PORT = 8791;
function readEnvFile(file: string, only?: RegExp) {
  const out: Record<string, string> = {};
  if (!existsSync(file)) throw new Error(`E2E env file not found: ${file}`);
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (m && (!only || only.test(m[1]))) out[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}
const envFile = process.env.E2E_ENV_FILE;
const nexconnEnv = process.env.E2E_NEXCONN === '1' && existsSync('.env.local') ? readEnvFile('.env.local', /^NEXCONN_/) : {};
const serverEnv: Record<string, string> = envFile
  ? { ...readEnvFile(envFile), AI_PROVIDER: 'rules' }
  : { UPLOAD_PROVIDER: 'local', ...nexconnEnv };

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx tsx server/index.ts',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...serverEnv,
      PORT: String(PORT),
      NODE_ENV: 'test',
      DATA_DIR: join(tmpdir(), `briefroom-e2e-${Date.now()}`),
    },
  },
});
