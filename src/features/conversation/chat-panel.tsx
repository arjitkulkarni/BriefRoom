import { AlertCircle, Check, CheckCheck, CircleAlert, FileCheck2, FileClock, Handshake, ImagePlus, Images, Loader2, MapPin, MessageSquareText, Paperclip, PencilLine, RotateCcw, Send, ShieldCheck, Sparkles, WifiOff, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EASE } from '@/components/motion/kit';
import type { BrPayload } from '@shared/messages';
import { cropBackground } from '@shared/geometry';
import { roleLabel, type OrderView, type Role } from '@shared/types';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { reclaimSession, type ConnSnapshot } from '@/services/nexconn/client';
import type { UiMessage } from '@/services/nexconn/use-channel';

export type FocusTarget = NonNullable<BrPayload['focus']>;

const EVENT_ICON: Partial<Record<string, LucideIcon>> = {
  ORDER_CREATED: Sparkles,
  REFERENCE_ADDED: Images,
  ANNOTATION_CREATED: MapPin,
  ANNOTATION_COMMENTED: MessageSquareText,
  ANNOTATION_RESOLVED: Check,
  CLARIFICATION_RAISED: CircleAlert,
  CLARIFICATION_RESOLVED: Check,
  SPECIFICATION_UPDATED: PencilLine,
  VERSION_PROPOSED: FileClock,
  VERSION_APPROVED: Check,
  VERSION_REJECTED: RotateCcw,
  ORDER_AGREED: Handshake,
  ORDER_COMPLETED: FileCheck2,
};

const dayLabel = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
};
const time = (ts: number) => new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

function ActivityCard({ p, order, onFocus }: { p: BrPayload; order: OrderView; onFocus: (f: FocusTarget) => void }) {
  const Icon = EVENT_ICON[p.eventType] ?? Sparkles;
  const agreed = p.eventType === 'ORDER_AGREED';
  // Display hints come from the message; trust comes from the backend: verify hashes against the API view.
  const version = p.snapshotHash ? order.versions.find((v) => v.number === p.versionNumber) : undefined;
  const verified = version ? version.snapshotHash === p.snapshotHash : null;
  const actionLabel =
    p.focus?.kind === 'annotation' ? `Show #${p.focus.number} on image` : p.focus?.kind === 'clarification' ? 'Open in radar' : p.focus?.kind === 'version' ? `Review version ${p.versionNumber}` : p.focus?.kind === 'spec' ? 'Open details' : null;
  return (
    <div className={cn('mx-auto w-full max-w-[340px] overflow-hidden rounded-lg border bg-activity text-sm shadow-xs', agreed ? 'border-success/40' : 'border-border')}>
      <div className={cn('flex items-center gap-2 border-b px-3 py-2 text-xs font-semibold', agreed ? 'border-success/30 bg-success-bg text-success-text' : 'border-divider text-muted-foreground')}>
        <Icon className="size-3.5" aria-hidden />
        <span className="flex-1 truncate">{p.actor.role === 'system' ? 'BriefRoom' : `${p.actor.name} · ${roleLabel(p.actor.role)}`}</span>
        <time className="font-normal">{time(p.at)}</time>
      </div>
      {p.crop && (
        <div className="h-24 w-full bg-surface-secondary bg-no-repeat" style={{ backgroundImage: `url("${new URL(p.crop.imageUrl, window.location.origin).pathname + new URL(p.crop.imageUrl, window.location.origin).search}")`, ...cropBackground(p.crop) }} aria-hidden />
      )}
      <div className="grid gap-1.5 px-3 py-2.5">
        <p className="font-medium text-foreground">{p.summary}</p>
        {p.lines && p.lines.length > 0 && (
          <ul className="grid gap-0.5 text-[13px] text-muted-foreground">
            {p.lines.slice(0, 6).map((l, i) => (
              <li key={i} className="truncate">
                {l}
              </li>
            ))}
          </ul>
        )}
        {p.snapshotHash && (
          <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            #{p.snapshotHash.slice(0, 12)}
            {verified === true && (
              <Badge tone="success" className="px-1.5 py-0 font-sans text-[10px]">
                <ShieldCheck aria-hidden /> verified
              </Badge>
            )}
            {verified === false && (
              <Badge tone="danger" className="px-1.5 py-0 font-sans text-[10px]">
                <AlertCircle aria-hidden /> does not match
              </Badge>
            )}
          </p>
        )}
        {actionLabel && p.focus && (
          <Button size="sm" variant={agreed ? 'success' : 'outline'} className="mt-1 justify-self-start" onClick={() => onFocus(p.focus!)}>
            {agreed ? 'Open agreement' : actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export interface ChatPanelProps {
  order: OrderView;
  enabled: boolean;
  conn: ConnSnapshot;
  messages: UiMessage[];
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  myUserId: string | null;
  onLoadOlder: () => void;
  onSendText: (t: string) => Promise<void>;
  onSendImage: (f: File) => Promise<void>;
  onFocus: (f: FocusTarget) => void;
  onAddToBrief: (url: string) => void;
  connectError: string | null;
  onRetry: () => void;
  className?: string;
}

export function ChatPanel(p: ChatPanelProps) {
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const atBottom = useRef(true);
  const roleOf = (uid: string): Role | null => p.order.participants.find((x) => x.nexconnUserId === uid)?.role ?? null;
  const nameOf = (uid: string) => p.order.participants.find((x) => x.nexconnUserId === uid)?.name ?? 'Unknown';

  useLayoutEffect(() => {
    const el = list.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [p.messages.length]);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const on = () => (atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener('scroll', on);
    return () => el.removeEventListener('scroll', on);
  }, []);

  if (!p.enabled)
    return (
      <div className={cn('p-4', p.className)}>
        <EmptyState icon={WifiOff} title="Live chat isn't connected yet">
          This server has no Nexconn credentials, so the real-time conversation and live sync are off. Nothing here is simulated. The brief itself still works — the other person sees changes when they refresh.
        </EmptyState>
      </div>
    );
  if (p.connectError && p.conn.state !== 'connected')
    return (
      <div className={cn('p-4', p.className)}>
        <ErrorState title="Chat could not connect" action={<Button size="sm" variant="outline" onClick={p.onRetry}>Try again</Button>}>
          {p.connectError}
        </ErrorState>
      </div>
    );
  if (p.conn.state === 'kicked')
    return (
      <div className={cn('p-4', p.className)}>
        <ErrorState title="Chat is open in another tab or device" action={<Button size="sm" onClick={() => void reclaimSession()}>Use chat here</Button>}>
          Nexconn keeps one web session per person. Continue here to move the conversation to this tab.
        </ErrorState>
      </div>
    );

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    atBottom.current = true;
    await p.onSendText(t);
  };

  let lastDay = '';
  return (
    <div className={cn('flex min-h-0 flex-col', p.className)}>
      <div ref={list} className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-live="polite" aria-relevant="additions">
        {p.hasMore && p.conn.state === 'connected' && (
          <div className="mb-3 flex justify-center">
            <Button size="sm" variant="ghost" onClick={p.onLoadOlder} loading={p.loading}>
              Load earlier messages
            </Button>
          </div>
        )}
        {p.conn.state !== 'connected' && p.messages.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Connecting to the order conversation…
          </div>
        )}
        {p.conn.state === 'connected' && p.messages.length === 0 && !p.loading && (
          <EmptyState icon={MessageSquareText} title="Start the conversation" className="border-none bg-transparent">
            Messages, photos and every brief update for this order appear here, in one private Nexconn group.
          </EmptyState>
        )}
        <ol className="flex flex-col gap-2.5">
          {p.messages.map((m) => {
            const day = dayLabel(m.sentTime);
            const showDay = day !== lastDay;
            lastDay = day;
            const mine = m.senderUserId === p.myUserId || m.id.startsWith('local-');
            const role = roleOf(m.senderUserId);
            return (
              <motion.li key={m.id} className="flex flex-col gap-2.5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE.settle }}>
                {showDay && (
                  <div className="my-1 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" aria-hidden>
                    <span className="h-px flex-1 bg-divider" />
                    {day}
                    <span className="h-px flex-1 bg-divider" />
                  </div>
                )}
                {m.kind === 'activity' && m.activity ? (
                  <ActivityCard p={m.activity} order={p.order} onFocus={p.onFocus} />
                ) : (
                  <div className={cn('flex max-w-[86%] flex-col gap-1', mine ? 'items-end self-end' : 'items-start self-start')}>
                    <span className="px-1 text-[11px] font-semibold text-muted-foreground">
                      {mine ? 'You' : nameOf(m.senderUserId)}
                      {role && !mine && <span className="font-normal"> · {roleLabel(role)}</span>}
                    </span>
                    <div className={cn('rounded-lg border text-sm', mine ? 'rounded-br-sm border-bubble-own-border bg-bubble-own' : 'rounded-bl-sm border-bubble-other-border bg-bubble-other', m.kind === 'image' ? 'overflow-hidden p-1' : 'px-3 py-2')}>
                      {m.kind === 'image' && m.imageUrl ? (
                        <figure className="grid gap-1">
                          <a href={m.imageUrl} target="_blank" rel="noreferrer">
                            <img src={m.thumbnail ?? m.imageUrl} alt="Shared photo" className="max-h-60 w-auto max-w-full rounded-md object-contain" loading="lazy" />
                          </a>
                          {!m.id.startsWith('local-') && (
                            <Button size="sm" variant="ghost" className="justify-start" onClick={() => p.onAddToBrief(m.imageUrl!)}>
                              <ImagePlus /> Add to brief
                            </Button>
                          )}
                        </figure>
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-foreground">{m.text}</p>
                      )}
                    </div>
                    <span className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                      {time(m.sentTime)}
                      {mine && m.state === 'sending' && <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-label="Sending" />}
                      {mine && m.state === 'sent' && <Check className="size-3" aria-label="Sent" />}
                      {mine && m.state === 'read' && <CheckCheck className="size-3 text-info-text" aria-label="Read" />}
                      {mine && m.state === 'failed' && (
                        <button className="inline-flex items-center gap-1 font-semibold text-destructive-text underline-offset-2 hover:underline" onClick={m.local?.retry}>
                          <AlertCircle className="size-3" aria-hidden /> Not sent · Retry
                        </button>
                      )}
                    </span>
                  </div>
                )}
              </motion.li>
            );
          })}
        </ol>
        {p.error && <p className="mt-3 text-center text-xs text-destructive-text">{p.error}</p>}
      </div>

      <div className="border-t border-divider bg-surface p-3">
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void p.onSendImage(f);
            }}
          />
          <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={p.conn.state !== 'connected'} aria-label="Send a photo">
            <Paperclip />
          </Button>
          <Textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={p.conn.state === 'connected' ? 'Message…' : 'Connecting…'}
            aria-label="Message"
            disabled={p.conn.state !== 'connected'}
            className="max-h-32 min-h-10"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button size="icon" onClick={send} disabled={!text.trim() || p.conn.state !== 'connected'} aria-label="Send message">
            <Send />
          </Button>
        </div>
      </div>
    </div>
  );
}
