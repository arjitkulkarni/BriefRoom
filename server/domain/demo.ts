/**
 * One-click live demo: a real shop and real orders (same tables, same commands, same Nexconn group
 * channels as any other order). Nothing is faked. Every step below goes through the domain commands,
 * so the activity cards, versions, fingerprints and diffs are the real thing.
 *
 * The story matches the landing page: Priya orders her sister Aditi's 25th birthday cake from Neha
 * (Sugar & Sprinkles, Pune). Version 1 was quoted at ₹1,850; Priya asked for 2 kg and ivory sugar
 * roses, so Neha cleared the old price. The visitor then plays both people for the last mile:
 * re-quote, propose version 2, compare it with version 1, and approve on both sides.
 *
 * The seller's dashboard also gets three other orders (collecting, agreed, completed), so it looks
 * like a working shop.
 *
 * Seeding takes many round trips, so a small warm pool keeps finished demos ready to hand out.
 * Demo shops are marked by their Nexconn user-ID prefix so public usage numbers can leave them out.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { domainEvents, participants } from '../db/schema.ts';
import { HttpError } from '../http/errors.ts';
import type { NexconnServerApi } from '../nexconn/client.ts';
import type { createChannelManager } from '../nexconn/outbox.ts';
import type { Commands } from './commands.ts';
import type { CoreService, OrderAccess } from './service.ts';

export const DEMO_USER_PREFIX = 'demo';

export type DemoSession = { shopId: string; orderId: string; sellerKey: string; customerKey: string };

export interface DemoDeps {
  db: Db;
  core: CoreService;
  commands: Commands;
  nexconn: NexconnServerApi;
  channels: ReturnType<typeof createChannelManager>;
}

/* ------------------------------------------------------------------ helpers */

const images = new Map<string, Promise<Buffer>>();
function image(name: string): Promise<Buffer> {
  let p = images.get(name);
  if (!p) {
    const path = [`public/images/${name}`, `dist/images/${name}`].map((x) => join(process.cwd(), x)).find((x) => existsSync(x));
    if (!path) return Promise.reject(new HttpError(503, `The demo image ${name} is missing on the server.`));
    p = readFile(path);
    p.catch(() => images.delete(name));
    images.set(name, p);
  }
  return p;
}

const isoDate = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const latest = async (core: CoreService, access: OrderAccess) => {
  const view = await core.getOrderView(access);
  const v = view.versions.find((x) => x.id === view.latestVersionId);
  if (!v) throw new Error('demo seed: no version to decide');
  return v;
};

async function approveBoth(core: CoreService, commands: Commands, seller: OrderAccess, customer: OrderAccess) {
  const v = await latest(core, seller);
  await commands.decideVersion(customer, v.id, { decision: 'approved', snapshotHash: v.snapshotHash });
  await commands.decideVersion(seller, v.id, { decision: 'approved', snapshotHash: v.snapshotHash });
}

/* ------------------------------------------------------------------ the main order */

// Normalised boxes on reference-berry-cake.jpg (1400 × 2095).
const BERRIES_ON_TOP = { shape: 'rect', x: 0.23, y: 0.235, w: 0.51, h: 0.17 } as const;
// The leaf on the left of the middle tier: well clear of box #1 so the two pins never overlap.
const LEAF = { shape: 'rect', x: 0.035, y: 0.64, w: 0.12, h: 0.08 } as const;

async function seedMainOrder({ core, commands }: DemoDeps, shopId: string, sellerKey: string) {
  const { orderId, customerKey } = await core.createOrder(shopId, { customerName: 'Priya', template: 'cake', title: 'Aditi’s 25th birthday cake' }, 'seller');
  const seller = await core.orderAccess(orderId, sellerKey);
  const customer = await core.orderAccess(orderId, customerKey);

  // 1. "Something like this, but…": the photo, marked up.
  const { referenceId } = await commands.addReference(customer, await image('reference-berry-cake.jpg'), 'Something like this, for my sister Aditi’s 25th');
  const roses = await commands.createAnnotation(customer, { referenceId, kind: 'change', color: '#f4ebd9', note: 'Can we change these to ivory roses?', ...BERRIES_ON_TOP });
  const leaves = await commands.createAnnotation(customer, { referenceId, kind: 'keep', note: 'Keep the leaves green.', ...LEAF });
  await commands.updateSpec(customer, {
    occasion: 'Birthday',
    weight: '1.5 kg',
    tiers: '2',
    shape: 'Round',
    flavour: 'Red velvet',
    eggless: true,
    frosting: 'Whipped cream',
    colours: ['#fffaf0', '#f4ebd9', '#6b8f5e'],
    theme: 'Ivory and white, soft and elegant',
    message: 'Happy 25th, Aditi!',
    deliveryDate: isoDate(5),
    timeSlot: 'Evening (4–8)',
    fulfilment: 'Delivery',
    address: 'Flat 402, Lotus Residency, Kalyani Nagar, Pune 411006',
    notes: 'It’s a surprise. Please call me, not Aditi!',
  });
  await commands.commentAnnotation(seller, roses.annotationId, 'Yes! Sugar roses or fresh ones? Sugar roses hold their shape better for photos.');

  // 2. Version 1, quoted from the photo.
  await commands.updateSpec(seller, { price: 1850, advance: 500 });
  await commands.proposeVersion(seller, 'Quote for 1.5 kg, two tiers, as in your photo.');

  // 3. Priya wants it bigger and settles the roses.
  const v1 = await latest(core, customer);
  await commands.decideVersion(customer, v1.id, { decision: 'changes_requested', snapshotHash: v1.snapshotHash, reason: 'Can we go up to 2 kg? We’ll be about 20 people. And sugar roses, please.' });
  await commands.commentAnnotation(customer, roses.annotationId, 'Sugar roses, please! Ivory, like we said.');
  await commands.commentAnnotation(seller, leaves.annotationId, 'Should I keep the leaves green with the roses too?');
  await commands.commentAnnotation(customer, leaves.annotationId, 'Yes, keep them green.');
  await commands.annotationResolution(customer, leaves.annotationId, 'request');
  await commands.annotationResolution(seller, leaves.annotationId, 'confirm');
  await commands.updateSpec(customer, { weight: '2 kg', toppers: 'Ivory sugar roses with green leaves' });

  // 4. A clarification that blocked the next version until Priya answered it.
  const { clarificationId } = await commands.raiseClarification(seller, { title: 'Should “Happy 25th, Aditi!” be piped on the cake or on a topper?', critical: true });
  await commands.commentClarification(customer, clarificationId, 'Piped on the cake, in gold if you can.');
  await commands.updateClarification(seller, clarificationId, { action: 'resolve', resolution: 'Piped in gold on the top tier.' });

  // 5. 2 kg changes the quote. The Radar is left with exactly one thing to do: Neha's new price.
  await commands.updateSpec(seller, { price: '' });

  return { orderId, customerKey };
}

/** The last few chat lines, sent once the order's activity cards are in the channel so the order reads right. */
const CONVERSATION: { role: 'customer' | 'seller'; text: string }[] = [
  { role: 'customer', text: 'Hi Neha! I’ve asked for changes on version 1: 2 kg for about 20 people, and the ivory sugar roses from #1 🌹' },
  { role: 'seller', text: 'Got it! 2 kg changes the quote, so I’ve cleared the old price. Version 2 is coming up in a few minutes 👩‍🍳' },
  { role: 'customer', text: 'Perfect, thank you! Aditi is going to love it 🎂' },
];

async function narrate({ db, nexconn, channels }: DemoDeps, orderId: string) {
  if (!nexconn.enabled) return;
  // Wait (bounded) for the outbox to deliver this order's events.
  const deadline = Date.now() + 120_000;
  for (;;) {
    const waiting = await db
      .select({ id: domainEvents.id })
      .from(domainEvents)
      .where(and(eq(domainEvents.orderId, orderId), inArray(domainEvents.nexconnStatus, ['pending', 'sending'])))
      .limit(1);
    if (!waiting.length) break;
    if (Date.now() > deadline) return console.warn(`[demo] ${orderId}: activity still pending after 120 s; skipping the chat lines`);
    await sleep(750);
  }
  const ch = await channels.ensureChannel(orderId);
  if (!ch.ready) return console.warn(`[demo] ${orderId}: channel not ready (${ch.error ?? 'unknown'}); skipping the chat lines`);
  const people = await db.select().from(participants).where(eq(participants.orderId, orderId));
  for (const line of CONVERSATION) {
    const p = people.find((x) => x.role === line.role);
    if (!p) continue;
    await channels.registerUser(p.nexconnUserId, p.displayName);
    await nexconn.sendGroupMessage({ fromUserId: p.nexconnUserId, channelId: ch.channelId, messageType: 'RC:TxtMsg', content: JSON.stringify({ content: line.text }) });
    await sleep(250); // distinct send times keep the order stable in history
  }
}

/* ------------------------------------------------------------------ the rest of the shop */

async function seedOtherOrders({ core, commands }: DemoDeps, shopId: string, sellerKey: string) {
  const open = async (customerName: string, title: string) => {
    const { orderId, customerKey } = await core.createOrder(shopId, { customerName, template: 'cake', title }, 'seller');
    return { seller: await core.orderAccess(orderId, sellerKey), customer: await core.orderAccess(orderId, customerKey) };
  };

  // Still collecting: a question on the photo waits for the customer.
  const kabir = async () => {
    const { seller, customer } = await open('Ananya', 'Kabir’s dinosaur birthday cake');
    const { referenceId } = await commands.addReference(customer, await image('craft-piping.jpg'), 'This piping style, with a dinosaur on top');
    await commands.updateSpec(customer, { occasion: 'Birthday', weight: '1 kg', shape: 'Round', flavour: 'Chocolate truffle', theme: 'Dinosaurs, green and orange', message: 'Roar! Happy 5th, Kabir', deliveryDate: isoDate(9) });
    await commands.createAnnotation(seller, { referenceId, kind: 'question', note: 'Same green for the piping, or would you like it in orange?', shape: 'point', x: 0.5, y: 0.45 });
  };

  // Agreed: both approved version 1, waiting for the bake.
  const rohan = async () => {
    const { seller, customer } = await open('Vikram', 'Rohan’s graduation cake');
    const { referenceId } = await commands.addReference(customer, await image('drip-cake.jpg'), 'A drip cake like this one');
    await commands.createAnnotation(customer, { referenceId, kind: 'colour', color: '#1e3a8a', note: 'Navy blue drip instead, his college colour', shape: 'rect', x: 0.3, y: 0.25, w: 0.4, h: 0.3 });
    await commands.updateSpec(customer, { occasion: 'Graduation', weight: '1.5 kg', tiers: '1', shape: 'Round', flavour: 'Chocolate truffle', frosting: 'Ganache', message: 'Congrats, Graduate!', deliveryDate: isoDate(3), timeSlot: 'Afternoon (12–4)', fulfilment: 'Pickup' });
    await commands.updateSpec(seller, { price: 1600, advance: 400 });
    await commands.proposeVersion(seller, 'Navy drip, gold “Congrats, Graduate!” topper.');
    await approveBoth(core, commands, seller, customer);
  };

  // Completed last week.
  const meera = async () => {
    const { seller, customer } = await open('Meera', 'Meera & Arjun’s anniversary cake');
    await commands.addReference(customer, await image('pink-drip-cake.jpg'), 'Exactly this, but heart-shaped');
    await commands.updateSpec(customer, { occasion: 'Anniversary', weight: '1 kg', tiers: '1', shape: 'Heart', flavour: 'Rasmalai', eggless: true, frosting: 'Buttercream', message: 'Happy 10th, M & A', deliveryDate: isoDate(-4), timeSlot: 'Midnight surprise', fulfilment: 'Delivery', address: 'Koregaon Park, Pune' });
    await commands.updateSpec(seller, { price: 1450 });
    await commands.proposeVersion(seller, 'Heart-shaped, rasmalai, pink drip.');
    await approveBoth(core, commands, seller, customer);
    await commands.completeOrder(seller);
  };

  const results = await Promise.allSettled([kabir(), rohan(), meera()]);
  for (const r of results) if (r.status === 'rejected') console.warn('[demo] a dashboard order could not be seeded:', (r.reason as Error).message);
}

/* ------------------------------------------------------------------ one demo */

/**
 * Creates the shop and the main order (awaited: it is what the visitor opens), then fills in the
 * dashboard orders and the chat lines in the background (`settled`).
 */
export async function createDemo(deps: DemoDeps): Promise<{ session: DemoSession; settled: Promise<void> }> {
  const { shop, sellerKey } = await deps.core.createShop({ name: 'Sugar & Sprinkles', ownerName: 'Neha', category: 'cake', city: 'Pune' }, { demo: true });
  const { orderId, customerKey } = await seedMainOrder(deps, shop.id, sellerKey);
  const settled = (async () => {
    await Promise.all([
      seedOtherOrders(deps, shop.id, sellerKey),
      narrate(deps, orderId).catch((e) => console.warn(`[demo] ${orderId}: chat lines not sent:`, (e as Error).message)),
    ]);
  })();
  return { session: { shopId: shop.id, orderId, sellerKey, customerKey }, settled };
}

/* ------------------------------------------------------------------ warm pool */

const MAX_AGE_MS = 6 * 3_600_000;
const REFILL_DELAY_MS = 20_000;

/**
 * Hands out a finished demo instantly and seeds the next one in the background.
 * Nothing is seeded until `start()` (the HTTP server calls it; tests do not), so an empty pool
 * simply seeds on demand.
 */
export function createDemoService(deps: DemoDeps, opts: { poolSize: number }) {
  const ready: { session: DemoSession; at: number }[] = [];
  const background = new Set<Promise<unknown>>();
  let filling = 0;
  let started = false;
  let timer: NodeJS.Timeout | null = null;

  const track = <T>(p: Promise<T>) => {
    background.add(p);
    void p.finally(() => background.delete(p)).catch(() => undefined);
    return p;
  };

  function fill() {
    if (!started) return;
    while (ready.length + filling < opts.poolSize) {
      filling++;
      track(
        (async () => {
          const t0 = Date.now();
          try {
            const { session, settled } = await createDemo(deps);
            await settled;
            ready.push({ session, at: Date.now() });
            console.log(`[demo] ready in ${((Date.now() - t0) / 1000).toFixed(1)} s (${ready.length}/${opts.poolSize} waiting)`);
          } catch (e) {
            // No retry loop: the next visitor seeds on demand and calls fill() again.
            console.warn('[demo] pre-seeding failed:', (e as Error).message);
          } finally {
            filling--;
          }
        })(),
      );
    }
  }

  return {
    /** A demo for one visitor: from the pool when one is ready, otherwise seeded now. */
    async take(): Promise<DemoSession> {
      const item = ready.shift();
      // Refill a little later: seeding is busy work for the database and the outbox, and the
      // visitor's first live interactions should not compete with it.
      if (item) {
        setTimeout(fill, REFILL_DELAY_MS).unref?.();
        return item.session;
      }
      fill();
      const { session, settled } = await createDemo(deps);
      track(settled.catch((e) => console.warn('[demo] background seeding failed:', (e as Error).message)));
      return session;
    },
    start() {
      if (started || opts.poolSize <= 0) return;
      started = true;
      fill();
      // Replace demos that have waited too long (chat times and dates should feel current).
      timer = setInterval(() => {
        const cutoff = Date.now() - MAX_AGE_MS;
        while (ready.length && ready[0].at < cutoff) ready.shift();
        fill();
      }, 15 * 60_000);
      timer.unref?.();
    },
    stop() {
      started = false;
      if (timer) clearInterval(timer);
      timer = null;
    },
    /** Resolves when no background seeding is running (tests, shutdown). */
    async idle() {
      while (background.size) await Promise.allSettled([...background]);
    },
    get readyCount() {
      return ready.length;
    },
  };
}

export type DemoService = ReturnType<typeof createDemoService>;
