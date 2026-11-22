/**
 * Nexconn Chat SDK client (browser).
 *
 * Sequence (docs: /chatsdk-web/init.md, /message/customize.md, /message/receive.md, /connection/connect.md):
 *   1. NCEngine.initialize({ appKey, areaCode })        — once per page load, data centre from the server config
 *   2. NCEngine.registerCustomMessages(BR_REGISTRATIONS) — BEFORE connect (installed SDK field: `isPersisted`)
 *   3. addMessageHandler / addConnectionStatusHandler  — BEFORE connect so no event is missed
 *   4. NCEngine.connect({ token })                      — token issued by OUR server (never in the browser)
 * The SDK is loaded lazily so the landing page does not pay for it.
 *
 * Mode: the seller inbox uses Nexconn Chat UI, which must be initialised before connect and registers
 * the custom types itself. A page load is therefore either 'sdk' (workspace) or 'chatui' (dashboard).
 */
import { BR_REGISTRATIONS } from '@shared/messages';
import type { PublicConfig } from '@shared/types';
import { getConfig } from '@/lib/api';

type Sdk = typeof import('@nexconn/chat');
export type ChatMessage = import('@nexconn/chat').Message<Record<string, any>>;
export type ConnState = 'idle' | 'disabled' | 'connecting' | 'connected' | 'reconnecting' | 'kicked' | 'error';
export interface ConnSnapshot {
  state: ConnState;
  userId: string | null;
  error: string | null;
  code?: number;
}

const ERRORS: Record<number, string> = {
  31004: 'The chat token expired.',
  31005: 'The Nexconn App Key does not match this token (check NEXCONN_ENVIRONMENT / keys on the server).',
  31010: 'This chat account was opened in another tab or device.',
  33007: 'Lost the chat connection after several retries.',
  34001: 'Could not reach the Nexconn data centre (check NEXCONN_REGION on the server).',
  34006: 'The Nexconn App Key is invalid.',
};

let sdkP: Promise<Sdk> | null = null;
let initP: Promise<{ sdk: Sdk; config: PublicConfig }> | null = null;
let mode: 'sdk' | 'chatui' | null = null;
let snapshot: ConnSnapshot = { state: 'idle', userId: null, error: null };
let connectP: Promise<string> | null = null;
let lastTokenFetcher: ((refresh: boolean) => Promise<{ token: string; userId: string }>) | null = null;

const statusListeners = new Set<(s: ConnSnapshot) => void>();
const messageListeners = new Set<(m: ChatMessage[]) => void>();

function setSnapshot(s: Partial<ConnSnapshot>) {
  snapshot = { ...snapshot, ...s };
  statusListeners.forEach((l) => l(snapshot));
}

export const loadSdk = () => (sdkP ??= import('@nexconn/chat'));
export const getSnapshot = () => snapshot;
export function onStatus(l: (s: ConnSnapshot) => void) {
  statusListeners.add(l);
  return () => void statusListeners.delete(l);
}
export function onMessages(l: (m: ChatMessage[]) => void) {
  messageListeners.add(l);
  return () => void messageListeners.delete(l);
}
export const currentMode = () => mode;

/** Initialise the engine once. `withChatUI` is called for the seller inbox (registers types itself). */
export function initEngine(want: 'sdk' | 'chatui', withChatUI?: (sdk: Sdk) => Promise<void>) {
  if (initP) {
    if (want === 'chatui' && mode === 'sdk') return Promise.reject(new ModeSwitchRequired());
    return initP;
  }
  mode = want;
  initP = (async () => {
    const config = await getConfig();
    if (!config.nexconn.enabled || !config.nexconn.appKey) {
      setSnapshot({ state: 'disabled', error: 'Nexconn is not configured on the server yet.' });
      throw new NexconnDisabled();
    }
    const sdk = await loadSdk();
    sdk.NCEngine.initialize({ appKey: config.nexconn.appKey, areaCode: config.nexconn.areaCode as never, logLevel: import.meta.env.DEV ? sdk.LogLevel.INFO : sdk.LogLevel.WARN });
    sdk.NCEngine.addConnectionStatusHandler(
      'briefroom-status',
      new sdk.ConnectionStatusHandler({
        onConnectionStatusChanged({ status, code }) {
          const S = sdk.ConnectionStatus;
          if (status === S.CONNECTED) setSnapshot({ state: 'connected', error: null, code: undefined });
          else if (status === S.CONNECTING) setSnapshot({ state: snapshot.state === 'connected' ? 'reconnecting' : 'connecting' });
          else if (code === 31010) setSnapshot({ state: 'kicked', error: ERRORS[31010], code });
          else if (code === 31004 && lastTokenFetcher) void reconnectWithFreshToken();
          else setSnapshot({ state: 'reconnecting', error: code ? (ERRORS[code] ?? `Connection issue (code ${code}).`) : null, code });
        },
      }),
    );
    sdk.NCEngine.addMessageHandler(
      'briefroom-messages',
      new sdk.MessageHandler({
        onMessageReceived({ messages }) {
          messageListeners.forEach((l) => l(messages as ChatMessage[]));
        },
      }),
    );
    if (withChatUI) await withChatUI(sdk);
    else sdk.NCEngine.registerCustomMessages(BR_REGISTRATIONS.map((r) => ({ messageType: r.messageType, isPersisted: r.isPersisted, isCounted: r.isCounted })));
    return { sdk, config };
  })();
  initP.catch(() => {
    initP = null;
    mode = null;
  });
  return initP;
}

async function reconnectWithFreshToken() {
  if (!lastTokenFetcher) return;
  const fetcher = lastTokenFetcher;
  connectP = null;
  snapshot = { ...snapshot, userId: null };
  await connect(fetcher, true).catch(() => undefined);
}

/**
 * Connect as the user whose token `fetchToken` returns. Switching to a different user
 * (e.g. testing seller and customer in one browser) disconnects the previous session first.
 */
export async function connect(fetchToken: (refresh: boolean) => Promise<{ token: string; userId: string }>, refresh = false): Promise<string> {
  const { sdk } = await initP!;
  lastTokenFetcher = fetchToken;
  if (connectP) return connectP;
  connectP = (async () => {
    setSnapshot({ state: 'connecting', error: null });
    let { token, userId } = await fetchToken(refresh);
    if (snapshot.userId && snapshot.userId !== userId) {
      await sdk.NCEngine.disconnect();
      setSnapshot({ userId: null });
    }
    if (snapshot.userId === userId && snapshot.state === 'connected') return userId;
    let r = await sdk.NCEngine.connect({ token });
    if (!r.isOk && r.code === 31004 && !refresh) {
      ({ token, userId } = await fetchToken(true)); // token expired: ask our server for a fresh one
      r = await sdk.NCEngine.connect({ token });
    }
    if (!r.isOk || !r.data) {
      const msg = ERRORS[r.code] ?? `Could not connect to Nexconn (code ${r.code}).`;
      setSnapshot({ state: r.code === 31010 ? 'kicked' : 'error', error: msg, code: r.code });
      throw new Error(msg);
    }
    setSnapshot({ state: 'connected', userId: r.data.userId, error: null, code: undefined });
    return r.data.userId;
  })();
  connectP.catch(() => (connectP = null));
  return connectP;
}

/** After a "kicked" event: take the session back on this device. */
export async function reclaimSession() {
  if (!lastTokenFetcher) return;
  connectP = null;
  snapshot = { ...snapshot, userId: null };
  await connect(lastTokenFetcher, false);
}

export class NexconnDisabled extends Error {
  constructor() {
    super('Nexconn is not configured on the server yet.');
  }
}
export class ModeSwitchRequired extends Error {
  constructor() {
    super('Reload required to open the Chat UI inbox.');
  }
}
