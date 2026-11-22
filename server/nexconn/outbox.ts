/**
 * Transactional outbox → Nexconn.
 *
 * Domain events are committed together with the state change. This dispatcher then:
 *  1. claims pending events with a lease (FOR UPDATE SKIP LOCKED — safe with several instances),
 *  2. makes sure the order's group channel exists (idempotent: reserved ID, 25409 = exists),
 *  3. publishes the BR:* custom message from the actor's Nexconn user (isEchoToSender = 1),
 *  4. records the Nexconn message ID, or schedules a retry with exponential backoff.
 * Events of one order are delivered in order: a failure holds back that order's later events.
 */
import { and, eq, sql } from 'drizzle-orm';
import { EVENT_TO_MESSAGE } from '../../shared/messages.ts';
import type { DomainEventType, Role } from '../../shared/types.ts';
import type { Db } from '../db/client.ts';
import { domainEvents, nexconnChannels, participants, orders } from '../db/schema.ts';
import type { NexconnServerApi } from './client.ts';

const MAX_ATTEMPTS = 8;
/** Events claimed per round, and at most this many from any one order (orders are delivered in parallel). */
const BATCH = 50;
const PER_ORDER = 5;
const backoffSeconds = (attempt: number) => Math.min(300, 2 ** attempt);

export function createChannelManager(db: Db, nexconn: NexconnServerApi, tokenCache: Map<string, string>) {
  async function registerUser(userId: string, name: string) {
    // Issuing a token registers the user with Nexconn (docs: /platform-chat-api/user/register.md).
    if (tokenCache.has(userId)) return tokenCache.get(userId)!;
    const token = await nexconn.issueAccessToken(userId, name);
    tokenCache.set(userId, token);
    return token;
  }

  async function ensureChannel(orderId: string): Promise<{ channelId: string; ready: boolean; error?: string }> {
    const [ch] = await db.select().from(nexconnChannels).where(eq(nexconnChannels.orderId, orderId));
    if (!ch) throw new Error(`No channel reserved for order ${orderId}`);
    if (ch.status === 'ready') return { channelId: ch.channelId, ready: true };
    if (!nexconn.enabled) return { channelId: ch.channelId, ready: false, error: 'Nexconn not configured' };
    try {
      const people = await db.select().from(participants).where(eq(participants.orderId, orderId));
      const [order] = await db.select({ title: orders.title }).from(orders).where(eq(orders.id, orderId));
      for (const p of people) await registerUser(p.nexconnUserId, p.displayName);
      await nexconn.createGroupChannel({ channelId: ch.channelId, name: order?.title ?? 'BriefRoom order', owner: ch.ownerUserId, members: ch.memberUserIds });
      await db.update(nexconnChannels).set({ status: 'ready', readyAt: new Date(), lastError: null, attempts: sql`${nexconnChannels.attempts} + 1` }).where(eq(nexconnChannels.orderId, orderId));
      return { channelId: ch.channelId, ready: true };
    } catch (e) {
      const msg = (e as Error).message.slice(0, 500);
      await db
        .update(nexconnChannels)
        .set({ attempts: sql`${nexconnChannels.attempts} + 1`, lastError: msg, status: ch.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending' })
        .where(eq(nexconnChannels.orderId, orderId));
      return { channelId: ch.channelId, ready: false, error: msg };
    }
  }

  return { ensureChannel, registerUser };
}

export function createOutbox(db: Db, nexconn: NexconnServerApi, channels: ReturnType<typeof createChannelManager>) {
  let running = false;
  let again = false;
  let timer: NodeJS.Timeout | null = null;
  const stats = { sent: 0, failed: 0, lastError: null as string | null, lastRunAt: 0 };

  async function claim() {
    const res = await db.execute(sql`
      update domain_events set nexconn_status = 'sending', nexconn_lease_until = now() + interval '60 seconds'
      where id in (
        select e.id from domain_events e
        where ((e.nexconn_status = 'pending' and e.nexconn_next_attempt_at <= now())
            or (e.nexconn_status = 'sending' and e.nexconn_lease_until < now()))
          -- per-order ordering: wait while an EARLIER event of the same order is in backoff or in flight
          and not exists (
            select 1 from domain_events p
            where p.order_id = e.order_id and p.seq < e.seq
              and ((p.nexconn_status = 'pending' and p.nexconn_next_attempt_at > now())
                or (p.nexconn_status = 'sending' and p.nexconn_lease_until >= now()))
          )
          -- fairness: only the first few undelivered events of each order, so one busy order cannot fill a batch
          and e.id in (
            select r.id from (
              select d.id, row_number() over (partition by d.order_id order by d.seq) as rn
              from domain_events d
              where d.nexconn_status in ('pending', 'sending')
            ) r
            where r.rn <= ${PER_ORDER}
          )
        order by e.seq
        limit ${BATCH}
        for update skip locked
      )
      returning id, seq, order_id, type, actor_role, payload, nexconn_attempts`);
    const rows = (res as unknown as { rows: { id: string; seq: number | string; order_id: string; type: string; actor_role: string | null; payload: unknown; nexconn_attempts: number }[] }).rows;
    return rows.sort((a, b) => Number(a.seq) - Number(b.seq));
  }

  async function drain() {
    if (!nexconn.enabled) return;
    stats.lastRunAt = Date.now();
    const batch = await claim();
    // Orders are delivered in parallel, each one strictly in sequence, so a busy order (a freshly
    // seeded demo, a long chat) never holds back live updates for everyone else.
    const byOrder = new Map<string, typeof batch>();
    for (const ev of batch) byOrder.set(ev.order_id, [...(byOrder.get(ev.order_id) ?? []), ev]);
    await Promise.all([...byOrder.values()].map((events) => deliver(events)));
    // Keep going while there was work: the per-order cap can leave more behind a short batch.
    // (Failures go into backoff and are not claimable, so this ends.)
    if (batch.length) again = true;
  }

  async function deliver(events: Awaited<ReturnType<typeof claim>>) {
    let blocked = false;
    for (const ev of events) {
      if (blocked) {
        await db.update(domainEvents).set({ nexconnStatus: 'pending', nexconnLeaseUntil: null }).where(eq(domainEvents.id, ev.id));
        continue;
      }
      const attempts = ev.nexconn_attempts + 1;
      try {
        const ch = await channels.ensureChannel(ev.order_id);
        if (!ch.ready) throw new Error(`Channel not ready: ${ch.error ?? 'unknown'}`);
        const role = (ev.actor_role === 'customer' ? 'customer' : 'seller') as Role;
        const [sender] = await db.select().from(participants).where(and(eq(participants.orderId, ev.order_id), eq(participants.role, role)));
        if (!sender) throw new Error('No participant to send as');
        await channels.registerUser(sender.nexconnUserId, sender.displayName);
        const messageType = EVENT_TO_MESSAGE[ev.type as DomainEventType];
        const messageId = await nexconn.sendGroupMessage({ fromUserId: sender.nexconnUserId, channelId: ch.channelId, messageType, content: JSON.stringify(ev.payload), echoToSender: true });
        await db
          .update(domainEvents)
          .set({ nexconnStatus: 'sent', nexconnMessageId: messageId, nexconnMessageType: messageType, nexconnSentAt: new Date(), nexconnLeaseUntil: null, nexconnLastError: null, nexconnAttempts: attempts })
          .where(eq(domainEvents.id, ev.id));
        stats.sent++;
      } catch (e) {
        const msg = (e as Error).message.slice(0, 500);
        stats.failed++;
        stats.lastError = msg;
        blocked = true; // hold back this order's later events; other orders carry on
        await db
          .update(domainEvents)
          .set({
            nexconnStatus: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
            nexconnAttempts: attempts,
            nexconnLastError: msg,
            nexconnLeaseUntil: null,
            nexconnNextAttemptAt: new Date(Date.now() + backoffSeconds(attempts) * 1000),
          })
          .where(eq(domainEvents.id, ev.id));
      }
    }
  }

  async function run() {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        await drain();
      } while (again);
    } catch (e) {
      stats.lastError = (e as Error).message;
      console.error('[outbox]', stats.lastError);
    } finally {
      running = false;
    }
  }

  return {
    stats,
    /** Wake the dispatcher right after a commit (coalesced). */
    kick: () => void setImmediate(run),
    start(intervalMs = 5000) {
      if (!timer) timer = setInterval(run, intervalMs);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    runOnce: run,
  };
}
