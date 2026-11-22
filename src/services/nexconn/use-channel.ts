/**
 * Live message list for one Nexconn group channel (the order's private conversation).
 * History comes from the server (Web SDK has no local store); new messages arrive through
 * the global MessageHandler. Sends are optimistic with explicit sending/failed states.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isBrMessage, type BrPayload } from '@shared/messages';
import { uid } from '@/lib/utils';
import { getSnapshot, loadSdk, onMessages, onStatus, type ChatMessage, type ConnSnapshot } from './client';

export type UiMessageState = 'sending' | 'sent' | 'failed' | 'read';
export interface UiMessage {
  id: string;
  kind: 'text' | 'image' | 'activity' | 'other';
  senderUserId: string;
  sentTime: number;
  text?: string;
  imageUrl?: string;
  thumbnail?: string;
  activity?: BrPayload & { messageType: string };
  state: UiMessageState;
  local?: { retry: () => void };
}

function toUi(m: ChatMessage): UiMessage {
  const c = (m.content ?? {}) as Record<string, any>;
  // SentStatus: SENDING 10, FAILED 20, SENT 30, RECEIVED 40, READ 50 (installed engine typings)
  const state: UiMessageState = m.sentStatus === 10 ? 'sending' : m.sentStatus === 20 ? 'failed' : m.sentStatus === 50 ? 'read' : 'sent';
  const base = { id: m.messageId || String(m.sentTime), senderUserId: m.senderUserId, sentTime: m.sentTime, state };
  // SDK sends carry `text`; Platform API sends (server-seeded demo lines) carry `content`.
  if (m.messageType === 'RC:TxtMsg') return { ...base, kind: 'text', text: String(c.text ?? c.content ?? '') };
  if (m.messageType === 'RC:ImgMsg') return { ...base, kind: 'image', imageUrl: c.remoteUrl, thumbnail: c.thumbnailBase64 ? `data:image/jpeg;base64,${c.thumbnailBase64}` : undefined };
  if (isBrMessage(m.messageType)) {
    // Server-sent custom messages carry a JSON payload; tolerate both object and string content.
    const payload = (typeof c === 'string' ? safeParse(c) : c.v ? c : safeParse(c.content ?? '')) as BrPayload | null;
    if (payload?.v === 1) return { ...base, kind: 'activity', activity: { ...payload, messageType: m.messageType } };
  }
  return { ...base, kind: 'other', text: `[${m.messageType}]` };
}
const safeParse = (s: unknown) => {
  try {
    return typeof s === 'string' ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

const isForChannel = (m: ChatMessage, channelId: string) => m.channelIdentifier?.channelId === channelId;

export function useChannel(channelId: string | null, enabled: boolean, onActivity?: (p: BrPayload) => void) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conn, setConn] = useState<ConnSnapshot>(getSnapshot());
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryRef = useRef<any>(null);
  const activityRef = useRef(onActivity);
  activityRef.current = onActivity;

  useEffect(() => onStatus(setConn), []);

  const merge = useCallback((incoming: UiMessage[], prepend = false) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      const next = prepend ? [...fresh, ...prev] : [...prev, ...fresh];
      return next.sort((a, b) => a.sentTime - b.sentTime);
    });
  }, []);

  const loadOlder = useCallback(async () => {
    if (!queryRef.current) return;
    setLoading(true);
    try {
      const r = await queryRef.current.loadNextPage();
      if (!r.isOk) throw new Error(`Could not load history (code ${r.code})`);
      const page = (r.data?.data ?? []) as ChatMessage[];
      if (page.length < 30) setHasMore(false);
      merge(page.map(toUi), true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [merge]);

  // History once connected.
  useEffect(() => {
    if (!enabled || !channelId || conn.state !== 'connected') return;
    let cancelled = false;
    (async () => {
      const sdk = await loadSdk();
      if (cancelled) return;
      queryRef.current = sdk.BaseChannel.createMessagesQuery({ channelIdentifier: new sdk.GroupChannelIdentifier(channelId), pageSize: 30, isAscending: false });
      setMessages([]);
      setHasMore(true);
      await loadOlder();
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, channelId, conn.state === 'connected', loadOlder]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live messages for this channel.
  useEffect(() => {
    if (!enabled || !channelId) return;
    return onMessages((batch) => {
      const mine = batch.filter((m) => isForChannel(m, channelId));
      if (!mine.length) return;
      const ui = mine.map(toUi);
      merge(ui);
      for (const u of ui) if (u.activity) activityRef.current?.(u.activity);
    });
  }, [enabled, channelId, merge]);

  const sendText = useCallback(
    async (text: string) => {
      if (!channelId || !text.trim()) return;
      const sdk = await loadSdk();
      const tempId = `local-${uid()}`;
      const attempt = async () => {
        setMessages((p) => p.map((m) => (m.id === tempId ? { ...m, state: 'sending' } : m)));
        const r = await new sdk.GroupChannel(channelId).sendMessage(new sdk.SendTextMessageParams({ text: text.trim() }));
        if (!r.isOk || !r.data) {
          setMessages((p) => p.map((m) => (m.id === tempId ? { ...m, state: 'failed' } : m)));
          return;
        }
        const sent = toUi(r.data as ChatMessage);
        setMessages((p) => p.filter((m) => m.id !== sent.id).map((m) => (m.id === tempId ? sent : m)));
      };
      setMessages((p) => [...p, { id: tempId, kind: 'text', text: text.trim(), senderUserId: getSnapshot().userId ?? '', sentTime: Date.now(), state: 'sending', local: { retry: () => void attempt() } }]);
      await attempt();
    },
    [channelId],
  );

  const sendImage = useCallback(
    async (file: File) => {
      if (!channelId) return;
      const sdk = await loadSdk();
      const tempId = `local-${uid()}`;
      const preview = URL.createObjectURL(file);
      setMessages((p) => [...p, { id: tempId, kind: 'image', imageUrl: preview, senderUserId: getSnapshot().userId ?? '', sentTime: Date.now(), state: 'sending' }]);
      const params = await sdk.Helper.createSendImageMessageParams(file);
      if (!params.isOk || !params.data) {
        setMessages((p) => p.map((m) => (m.id === tempId ? { ...m, state: 'failed' } : m)));
        return;
      }
      const r = await new sdk.GroupChannel(channelId).sendMediaMessage(params.data);
      if (!r.isOk || !r.data) {
        setMessages((p) => p.map((m) => (m.id === tempId ? { ...m, state: 'failed' } : m)));
        return;
      }
      const sent = toUi(r.data as ChatMessage);
      setMessages((p) => p.filter((m) => m.id !== sent.id).map((m) => (m.id === tempId ? sent : m)));
    },
    [channelId],
  );

  return { messages, conn, loading, hasMore, error, loadOlder, sendText, sendImage };
}
