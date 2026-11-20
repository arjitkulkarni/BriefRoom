/**
 * Nexconn Platform Chat API client (server-side only - the App Secret never reaches a browser).
 *
 * Signing (docs: /platform-chat-api/prepare-to-use-api/auth.md):
 *   Signature = sha1(AppSecret + Nonce + Timestamp) as hex
 * Primary/backup domain failover per /platform-chat-api/prepare-to-use-api/base-url.md
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const APP_KEY = process.env.NEXCONN_APP_KEY ?? '';
const APP_SECRET = process.env.NEXCONN_APP_SECRET ?? '';
const DOMAINS = [
  process.env.NEXCONN_API_DOMAIN || 'api.sg-light-api.com',
  process.env.NEXCONN_API_DOMAIN_BACKUP || 'api-b.sg-light-api.com',
];
let active = 0;

export const nexconnConfigured = () => Boolean(APP_KEY && APP_SECRET && APP_KEY !== 'your-app-key');
export const publicAppKey = () => APP_KEY;
export const clientArea = () => (process.env.NEXCONN_AREA || 'SG').toUpperCase();

export class NexconnError extends Error {
  constructor(message: string, public readonly code?: number, public readonly httpStatus?: number, public readonly noFailover = false) {
    super(message);
  }
}

function headers(): Record<string, string> {
  const nonce = randomBytes(6).toString('hex');
  const timestamp = String(Date.now());
  return {
    'App-Key': APP_KEY,
    Nonce: nonce,
    Timestamp: timestamp,
    Signature: createHash('sha1').update(APP_SECRET + nonce + timestamp, 'utf8').digest('hex'),
    'X-Request-ID': randomUUID().replace(/-/g, ''),
    'Content-Type': 'application/json',
  };
}

async function call<T>(path: string, body: unknown): Promise<T> {
  if (!nexconnConfigured()) throw new NexconnError('Nexconn credentials missing: set NEXCONN_APP_KEY and NEXCONN_APP_SECRET in .env', undefined, undefined, true);
  let last: unknown;
  for (let i = 0; i < DOMAINS.length; i++) {
    try {
      const res = await fetch(`https://${DOMAINS[active]}${path}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        /* non-JSON */
      }
      if (res.status >= 500) throw new NexconnError(`Nexconn ${res.status}`, json.code, res.status);
      if (!res.ok || (typeof json.code === 'number' && json.code !== 0 && json.code !== 200)) {
        throw new NexconnError(
          `Nexconn ${path} failed: HTTP ${res.status} ${json.code ?? ''} ${json.msg ?? json.errorMessage ?? text.slice(0, 160)}`.trim(),
          json.code,
          res.status,
          true,
        );
      }
      return json as T;
    } catch (err) {
      last = err;
      if (err instanceof NexconnError && err.noFailover) throw err;
      active = (active + 1) % DOMAINS.length;
    }
  }
  throw last instanceof Error ? last : new NexconnError('Nexconn API unreachable');
}

/** POST /v4/auth/access-token/issue - registers the user and returns a connect token. */
export async function issueAccessToken(userId: string, name: string): Promise<string> {
  const json = await call<{ result?: { accessToken?: string } }>('/v4/auth/access-token/issue', { userId, name });
  const token = json.result?.accessToken;
  if (!token) throw new NexconnError('Nexconn did not return an access token');
  return token;
}

/** POST /v4/group-channel/create - one private group per order: seller (owner) + customer. */
export async function createGroupChannel(channelId: string, name: string, owner: string, members: string[]): Promise<void> {
  await call('/v4/group-channel/create', {
    channelId,
    name: name.slice(0, 64),
    owner,
    userIds: members,
    groupProfile: { introduction: 'BriefRoom order conversation' },
    permissions: { joinPerm: 3, invitePerm: 0 }, // nobody else can join; invitees need no consent
  });
}
