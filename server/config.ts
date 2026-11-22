/**
 * Environment configuration with startup validation.
 *
 * Production: any problem is fatal and printed as an actionable checklist.
 * Development: problems degrade features (Nexconn off, rules-only AI, local storage,
 * embedded PGlite database) and are printed as warnings — never silently faked.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AI_PROVIDER_LABEL, type AiProviderId } from '../shared/types.ts';

export type NexconnRegion = 'sg' | 'na' | 'sa';

/** OpenAI-compatible chat-completions providers. Grok's API (api.x.ai) uses the same request shape. */
export const AI_PROVIDERS: Record<AiProviderId, { baseUrl: string; keyVar: string; modelVar: string; defaultModel: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', keyVar: 'OPENAI_API_KEY', modelVar: 'OPENAI_MODEL', defaultModel: 'gpt-4o-mini' },
  xai: { baseUrl: 'https://api.x.ai/v1', keyVar: 'XAI_API_KEY', modelVar: 'XAI_MODEL', defaultModel: 'grok-4.20-non-reasoning' },
};
export interface AiProviderConfig {
  id: AiProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
}

/** Documented data centres: Server API hosts (primary, backup) + Chat SDK `AreaCode` value. */
export const NEXCONN_REGIONS: Record<NexconnRegion, { label: string; apiHosts: [string, string]; areaCode: number }> = {
  sg: { label: 'Singapore', apiHosts: ['api.sg-light-api.com', 'api-b.sg-light-api.com'], areaCode: 2 /* AreaCode.SG */ },
  na: { label: 'North America', apiHosts: ['api.us-light-api.com', 'api-b.us-light-api.com'], areaCode: 3 /* AreaCode.NA */ },
  sa: { label: 'Saudi Arabia', apiHosts: ['api.sau-light-api.com', 'api-b.sau-light-api.com'], areaCode: 5 /* AreaCode.SA */ },
};

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  publicUrl: string;
  dataDir: string;
  sessionSecret: string;
  database: { url: string | null; migrationUrl: string | null; embeddedDir: string };
  nexconn: {
    enabled: boolean;
    environment: 'development' | 'production';
    appKey: string;
    appSecret: string;
    region: NexconnRegion | null;
    apiHosts: string[];
    areaCode: number;
  };
  storage: {
    provider: 'local' | 's3';
    uploadsDir: string;
    s3: { bucket: string; endpoint: string; region: string; accessKeyId: string; secretAccessKey: string } | null;
  };
  /** `provider` = first choice; `chain` = providers tried in order (the next one is a fallback). Empty = rules only. */
  ai: { provider: AiProviderId | 'rules'; chain: AiProviderConfig[] };
}

export class ConfigError extends Error {}

const v = (k: string) => (process.env[k] ?? '').trim();
const isPlaceholder = (s: string) => !s || /^(your-|changeme|xxx|<)/i.test(s);

/** Neon URLs use sslmode=require, which node-postgres treats as verify-full (with a deprecation warning). Make that explicit. */
export function normalisePgUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.searchParams.get('sslmode') === 'require') u.searchParams.set('sslmode', 'verify-full');
    return u.toString();
  } catch {
    return url;
  }
}

export function loadConfig(): { config: AppConfig; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = v('NODE_ENV');
  const env: AppConfig['env'] = nodeEnv === 'production' ? 'production' : nodeEnv === 'test' ? 'test' : 'development';
  const prod = env === 'production';
  const problem = (msg: string) => (prod ? errors : warnings).push(msg);

  const port = Number(v('PORT') || 8787);
  if (!Number.isInteger(port) || port <= 0) errors.push(`PORT must be a positive integer (got "${v('PORT')}").`);

  const dataDir = resolve(v('DATA_DIR') || join(process.cwd(), 'data'));

  // ---------------------------------------------------------------- public URL
  // On Render, RENDER_EXTERNAL_URL (the service's onrender.com URL) is set automatically; PUBLIC_URL
  // overrides it, e.g. for a custom domain.
  // On Vercel, VERCEL_PROJECT_PRODUCTION_URL is the production domain (host only, no scheme).
  const vercelUrl = v('VERCEL_PROJECT_PRODUCTION_URL') ? `https://${v('VERCEL_PROJECT_PRODUCTION_URL')}` : '';
  let publicUrl = (v('PUBLIC_URL') || v('RENDER_EXTERNAL_URL') || vercelUrl).replace(/\/+$/, '');
  if (publicUrl && !/^https?:\/\//.test(publicUrl)) errors.push(`PUBLIC_URL must start with http:// or https:// (got "${publicUrl}").`);
  if (prod) {
    if (!publicUrl) errors.push('PUBLIC_URL is required in production (e.g. https://briefroom.example.com). Share links and image URLs are built from it.');
    else if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(publicUrl)) errors.push(`PUBLIC_URL points at localhost (${publicUrl}) — production links would be broken. Set your real HTTPS URL.`);
  }
  if (!publicUrl) publicUrl = `http://localhost:${port}`;

  // ---------------------------------------------------------------- session secret (signs asset URLs)
  let sessionSecret = v('SESSION_SECRET');
  if (!sessionSecret || sessionSecret.length < 32) {
    if (prod) errors.push('SESSION_SECRET must be set to a random string of at least 32 characters (e.g. `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"`).');
    else {
      const file = join(dataDir, '.dev-session-secret');
      if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
      if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('hex'));
      sessionSecret = readFileSync(file, 'utf8').trim();
      if (env === 'development') warnings.push(`SESSION_SECRET not set — using a generated development secret stored in ${file}.`);
    }
  }

  // ---------------------------------------------------------------- database
  const dbUrl = normalisePgUrl(v('DATABASE_URL'));
  const dbUnpooled = normalisePgUrl(v('DATABASE_URL_UNPOOLED'));
  if (dbUrl && !/^postgres(ql)?:\/\//.test(dbUrl)) errors.push('DATABASE_URL must be a postgres:// connection string (use the pooled Neon URL).');
  if (!dbUrl) {
    if (prod) errors.push('DATABASE_URL is required in production. Use the pooled Neon connection string (host contains "-pooler").');
    else if (env === 'development') warnings.push('DATABASE_URL not set — using an embedded PGlite database in data/pglite (development only). Run `neon env pull` or set DATABASE_URL to use Neon.');
  } else if (prod && !/-pooler\./.test(dbUrl)) {
    warnings.push('DATABASE_URL does not look like a pooled Neon URL (no "-pooler" in the host). Use the pooled URL for application traffic.');
  }

  // ---------------------------------------------------------------- Nexconn
  const nxEnvRaw = v('NEXCONN_ENVIRONMENT') || (prod ? 'production' : 'development');
  const nxEnv = nxEnvRaw === 'production' ? 'production' : 'development';
  if (nxEnvRaw !== 'production' && nxEnvRaw !== 'development') errors.push(`NEXCONN_ENVIRONMENT must be "development" or "production" (got "${nxEnvRaw}").`);
  const prefix = nxEnv === 'production' ? 'NEXCONN_PROD_' : 'NEXCONN_DEV_';
  let appKey = v(`${prefix}APP_KEY`);
  let appSecret = v(`${prefix}APP_SECRET`);
  if ((!appKey || !appSecret) && v('NEXCONN_APP_KEY') && v('NEXCONN_APP_SECRET')) {
    appKey = v('NEXCONN_APP_KEY');
    appSecret = v('NEXCONN_APP_SECRET');
    warnings.push(`Using legacy NEXCONN_APP_KEY/NEXCONN_APP_SECRET. Rename them to ${prefix}APP_KEY / ${prefix}APP_SECRET.`);
  }
  const nexconnEnabled = !isPlaceholder(appKey) && !isPlaceholder(appSecret);
  const regionRaw = v('NEXCONN_REGION').toLowerCase();
  const region = (regionRaw in NEXCONN_REGIONS ? regionRaw : null) as NexconnRegion | null;
  if (regionRaw && !region) errors.push(`NEXCONN_REGION must be one of ${Object.keys(NEXCONN_REGIONS).join(', ')} (got "${regionRaw}"). Use the data centre shown for your app in the Nexconn Console.`);
  if (nexconnEnabled && !region && !regionRaw)
    errors.push('NEXCONN_REGION is required when Nexconn keys are set: sg (Singapore), na (North America) or sa (Saudi Arabia) — it must match the data centre of your app in the Nexconn Console.');
  if (!nexconnEnabled) problem(`Nexconn ${nxEnv} credentials are missing (${prefix}APP_KEY / ${prefix}APP_SECRET). Real-time chat and live sync are disabled until they are set.`);
  if (prod && nxEnv !== 'production') warnings.push('NODE_ENV=production but NEXCONN_ENVIRONMENT=development — production traffic will use your Nexconn DEVELOPMENT app.');
  const regionInfo = region ? NEXCONN_REGIONS[region] : null;

  // ---------------------------------------------------------------- storage
  const s3Endpoint = v('AWS_ENDPOINT_URL_S3');
  const providerRaw = v('UPLOAD_PROVIDER') || (s3Endpoint ? 's3' : 'local');
  if (providerRaw !== 'local' && providerRaw !== 's3') errors.push(`UPLOAD_PROVIDER must be "local" or "s3" (got "${providerRaw}").`);
  const provider = providerRaw === 's3' ? 's3' : 'local';
  let s3: AppConfig['storage']['s3'] = null;
  if (provider === 's3') {
    const missing = ['AWS_ENDPOINT_URL_S3', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'].filter((k) => !v(k));
    if (missing.length) errors.push(`UPLOAD_PROVIDER=s3 needs ${missing.join(', ')} (run \`neon deploy\` / \`neon env pull\` to fetch Neon Object Storage credentials).`);
    else s3 = { bucket: v('S3_BUCKET') || 'assets', endpoint: s3Endpoint, region: v('AWS_REGION'), accessKeyId: v('AWS_ACCESS_KEY_ID'), secretAccessKey: v('AWS_SECRET_ACCESS_KEY') };
  } else if (prod) {
    warnings.push('UPLOAD_PROVIDER=local in production: uploads are only durable on a persistent disk (set DATA_DIR/UPLOADS_DIR to it), and only for a single instance.');
  }
  const uploadsDir = resolve(v('UPLOADS_DIR') || join(dataDir, 'uploads'));

  // ---------------------------------------------------------------- AI (optional; rules always run)
  const aiChoice = v('AI_PROVIDER').toLowerCase() || 'auto';
  if (!['auto', 'openai', 'xai', 'rules'].includes(aiChoice)) errors.push(`AI_PROVIDER must be auto, openai, xai or rules (got "${aiChoice}").`);
  const withKey = (Object.keys(AI_PROVIDERS) as AiProviderId[]).filter((id) => !isPlaceholder(v(AI_PROVIDERS[id].keyVar)));
  let aiOrder: AiProviderId[] = aiChoice === 'rules' ? [] : withKey; // auto: OpenAI first, then Grok
  if (aiChoice === 'openai' || aiChoice === 'xai') {
    const first: AiProviderId = aiChoice;
    if (!withKey.includes(first)) warnings.push(`AI_PROVIDER=${first} but ${AI_PROVIDERS[first].keyVar} is not set — ${withKey.length ? `using ${withKey.map((id) => AI_PROVIDER_LABEL[id]).join(', ')} instead` : 'the ambiguity check runs on rules only'}.`);
    aiOrder = [first, ...withKey.filter((id) => id !== first)].filter((id) => withKey.includes(id));
  }
  const chain = aiOrder.map((id) => ({ id, apiKey: v(AI_PROVIDERS[id].keyVar), model: v(AI_PROVIDERS[id].modelVar) || AI_PROVIDERS[id].defaultModel, baseUrl: AI_PROVIDERS[id].baseUrl }));
  const ai: AppConfig['ai'] = { provider: chain[0]?.id ?? 'rules', chain };

  return {
    config: {
      env,
      port,
      publicUrl,
      dataDir,
      sessionSecret,
      database: { url: dbUrl || null, migrationUrl: dbUnpooled || dbUrl || null, embeddedDir: join(dataDir, 'pglite') },
      nexconn: {
        enabled: nexconnEnabled && Boolean(regionInfo),
        environment: nxEnv,
        appKey,
        appSecret,
        region,
        apiHosts: regionInfo ? [...regionInfo.apiHosts] : [],
        areaCode: regionInfo?.areaCode ?? 0,
      },
      storage: { provider, uploadsDir, s3 },
      ai,
    },
    errors,
    warnings,
  };
}

export const mask = (s: string) => (s.length <= 6 ? '***' : `${s.slice(0, 3)}…${s.slice(-3)}`);

export function describeConfig(c: AppConfig): string[] {
  return [
    `mode: ${c.env} · port ${c.port} · public URL ${c.publicUrl}`,
    `database: ${c.database.url ? `Postgres ${safeHost(c.database.url)}` : `embedded PGlite (${c.database.embeddedDir})`}`,
    `storage: ${c.storage.provider === 's3' ? `S3 bucket "${c.storage.s3?.bucket}" @ ${safeHost(c.storage.s3?.endpoint ?? '')}` : `local disk (${c.storage.uploadsDir})`}`,
    `nexconn: ${c.nexconn.enabled ? `${c.nexconn.environment} app ${mask(c.nexconn.appKey)} · region ${c.nexconn.region} (${c.nexconn.apiHosts[0]})` : 'disabled (no credentials)'}`,
    `ai: ${c.ai.chain.length ? `${c.ai.chain.map((p, i) => `${i ? 'fallback ' : ''}${AI_PROVIDER_LABEL[p.id]} (${p.model})`).join(' → ')} + rules` : 'deterministic rules only (no OPENAI_API_KEY / XAI_API_KEY, or AI_PROVIDER=rules)'}`,
  ];
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return '(invalid url)';
  }
}
