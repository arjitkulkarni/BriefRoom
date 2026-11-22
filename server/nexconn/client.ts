/**
 * Nexconn Platform Chat API client — server side only; the App Secret never reaches a browser.
 *
 * Docs (fetched 2026-11-22 from docs.nexconn.ai):
 *  - Signing:   /platform-chat-api/prepare-to-use-api/auth.md   Signature = SHA1(AppSecret + Nonce + Timestamp(ms)), hex
 *  - Base URLs: /platform-chat-api/prepare-to-use-api/base-url.md (primary + backup per data centre;
 *               switch on timeout (5 s) or unexpected HTTP status)
 *  - Token:     POST /v4/auth/access-token/issue              { userId, name, avatarUrl? } -> result.accessToken
 *  - Group:     POST /v4/group-channel/create                 code 25409 = channel ID already exists
 *  - Message:   POST /v4/group-channel/message/send           { fromUserId, toChannelIds[], messageType, content(string), isEchoToSender }
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AppConfig } from '../config.ts';

export class NexconnError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly httpStatus?: number,
    /** Business errors are not retried on the backup domain. */
    readonly business = false,
  ) {
    super(message);
  }
}

export const NEXCONN_CODES = { GROUP_EXISTS: 25409, GROUP_NOT_FOUND: 25410, ALREADY_MEMBER: 25412 } as const;

export interface NexconnServerApi {
  readonly enabled: boolean;
  issueAccessToken(userId: string, name: string): Promise<string>;
  createGroupChannel(input: { channelId: string; name: string; owner: string; members: string[] }): Promise<'created' | 'exists'>;
  sendGroupMessage(input: { fromUserId: string; channelId: string; messageType: string; content: string; echoToSender?: boolean }): Promise<string | null>;
}

export function createNexconnClient(cfg: AppConfig['nexconn'], fetchImpl: typeof fetch = fetch): NexconnServerApi {
  let active = 0;

  function headers(): Record<string, string> {
    const nonce = randomBytes(8).toString('hex'); // ≤ 18 chars
    const timestamp = String(Date.now());
    return {
      'App-Key': cfg.appKey,
      Nonce: nonce,
      Timestamp: timestamp,
      Signature: createHash('sha1').update(cfg.appSecret + nonce + timestamp, 'utf8').digest('hex'),
      'X-Request-ID': randomUUID().replace(/-/g, ''),
      'Content-Type': 'application/json',
    };
  }

  async function call<T>(path: string, body: unknown): Promise<T & { code: number }> {
    if (!cfg.enabled) throw new NexconnError('Nexconn is not configured on the server', undefined, undefined, true);
    let last: unknown;
    for (let attempt = 0; attempt < cfg.apiHosts.length; attempt++) {
      const host = cfg.apiHosts[active];
      try {
        const res = await fetchImpl(`https://${host}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
        const text = await res.text();
        let json: { code?: number; msg?: string; errorMessage?: string } & Record<string, unknown> = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          /* non-JSON body */
        }
        if (res.status >= 500 || res.status === 429) throw new NexconnError(`Nexconn ${path} HTTP ${res.status}`, json.code, res.status);
        const code = typeof json.code === 'number' ? json.code : res.ok ? 0 : -1;
        if (!res.ok || (code !== 0 && code !== 200)) {
          throw new NexconnError(`Nexconn ${path} failed: HTTP ${res.status} code ${code} ${json.msg ?? json.errorMessage ?? text.slice(0, 160)}`.trim(), code, res.status, true);
        }
        return { ...(json as T), code };
      } catch (err) {
        last = err;
        if (err instanceof NexconnError && err.business) throw err;
        active = (active + 1) % cfg.apiHosts.length; // fail over to the other domain
      }
    }
    throw last instanceof Error ? last : new NexconnError('Nexconn API unreachable');
  }

  return {
    enabled: cfg.enabled,
    async issueAccessToken(userId, name) {
      const json = await call<{ result?: { accessToken?: string } }>('/v4/auth/access-token/issue', { userId, name: name.slice(0, 64) });
      const token = json.result?.accessToken;
      if (!token) throw new NexconnError('Nexconn did not return an access token');
      return token;
    },
    async createGroupChannel({ channelId, name, owner, members }) {
      try {
        await call('/v4/group-channel/create', {
          channelId,
          name: name.slice(0, 64),
          owner,
          userIds: members.slice(0, 30),
          groupProfile: { introduction: 'BriefRoom order conversation' },
          // joinPerm 3: nobody can join on their own; invitePerm 0: invitees need no consent.
          permissions: { joinPerm: 3, invitePerm: 0, memInvitePerm: 0 },
        });
        return 'created';
      } catch (err) {
        if (err instanceof NexconnError && err.code === NEXCONN_CODES.GROUP_EXISTS) return 'exists';
        throw err;
      }
    },
    async sendGroupMessage({ fromUserId, channelId, messageType, content, echoToSender = true }) {
      const json = await call<{ result?: { messageIds?: { channelId: string; messageId: string }[] } }>('/v4/group-channel/message/send', {
        fromUserId,
        toChannelIds: [channelId],
        messageType,
        content,
        shouldPersist: 1,
        isEchoToSender: echoToSender ? 1 : 0,
      });
      return json.result?.messageIds?.[0]?.messageId ?? null;
    },
  };
}
