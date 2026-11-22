/**
 * LIVE Nexconn verification — runs only when the test server has real Nexconn credentials
 * (`E2E_NEXCONN=1` or `E2E_ENV_FILE=.env.local`, see playwright.config.ts). Nothing is faked:
 * two independent browser contexts (seller desktop, buyer phone) connect with server-issued tokens
 * to the order's private group channel and exchange real messages through Nexconn.
 *
 * Covers: token auth + connect for two users · private group created on Nexconn · text both ways ·
 * image message · BR:* custom events driving live refresh · per-order ordering · idempotent replay ·
 * server history after reload · reconnection after a network drop.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isVendorTelemetryNoise } from './support/console';

const PHOTO = join(process.cwd(), 'public/images/craft-piping.jpg');
const REFERENCE = join(process.cwd(), 'public/images/reference-berry-cake.jpg');
/** Set while the buyer is deliberately offline: the browser then logs failed socket/resource loads. */
let networkDrop = false;
// While offline the SDK's socket fails; it logs the raw DOM `Event` of the WebSocket error.
const NETWORK_NOISE = /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_NAME_NOT_RESOLVED|WebSocket connection to .* failed|Failed to load resource: net::|^Event$/;
let vendorNoise = 0;

type Activity = { id: string; type: string; nexconnStatus: string; nexconnMessageId: string | null; seq?: number; summary?: string };

async function api(baseURL: string, method: string, path: string, key?: string, body?: unknown, extra: Record<string, string> = {}) {
  const res = await fetch(`${baseURL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(key ? { 'x-key': key } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json as any };
}

function watch(page: Page, label: string, problems: string[]) {
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error' || /Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) return;
    if (isVendorTelemetryNoise(m)) return void vendorNoise++;
    if (networkDrop && NETWORK_NOISE.test(m.text())) return;
    problems.push(`[${label}] console: ${m.text()}`);
  });
}

const pill = (page: Page) => page.getByRole('status').filter({ hasText: /^(Live|Connecting…|Reconnecting…|Chat offline|Open elsewhere|Live sync off)$/ }).first();
const chatLog = (page: Page) => page.locator('[aria-live="polite"][aria-relevant="additions"]').first();

test.describe('live Nexconn', () => {
  test.describe.configure({ mode: 'serial' });

  let baseURL: string;
  let seed: { shopId: string; sellerKey: string; orderId: string; customerKey: string };
  let sellerCtx: BrowserContext;
  let buyerCtx: BrowserContext;
  let seller: Page;
  let buyer: Page;
  const problems: string[] = [];

  test.beforeAll(async ({ browser }, info) => {
    baseURL = info.project.use.baseURL!;
    const cfg = await (await fetch(`${baseURL}/api/config`)).json();
    test.skip(!cfg.nexconn.enabled, 'Server has no Nexconn credentials — run with E2E_NEXCONN=1 or E2E_ENV_FILE=.env.local');

    const shop = await api(baseURL, 'POST', '/api/shops', undefined, { name: 'Live Check Bakes', ownerName: 'Neha', category: 'cake', city: 'Pune' });
    expect(shop.status).toBe(201);
    const order = await api(baseURL, 'POST', `/api/shops/${shop.body.shop.id}/orders`, shop.body.sellerKey, { customerName: 'Priya', template: 'cake', title: 'Live sync check cake' });
    expect(order.status).toBe(201);
    seed = { shopId: shop.body.shop.id, sellerKey: shop.body.sellerKey, orderId: order.body.orderId, customerKey: order.body.customerKey };

    sellerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    buyerCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await sellerCtx.addInitScript(([id, k]) => localStorage.setItem(`br.seller.${id}`, k), [seed.shopId, seed.sellerKey]);
    seller = await sellerCtx.newPage();
    buyer = await buyerCtx.newPage();
    watch(seller, 'seller', problems);
    watch(buyer, 'buyer', problems);
  });

  test.afterAll(async () => {
    await sellerCtx?.close();
    await buyerCtx?.close();
  });

  test('1 · server-issued tokens: two independent users connect to the private group channel', async () => {
    // Token endpoint: issued by OUR server per participant; never generated in the browser.
    const tSeller = await api(baseURL, 'POST', '/api/nexconn/token', seed.sellerKey, { orderId: seed.orderId });
    const tBuyer = await api(baseURL, 'POST', '/api/nexconn/token', seed.customerKey, { orderId: seed.orderId });
    expect(tSeller.status, JSON.stringify(tSeller.body)).toBe(200);
    expect(tBuyer.status, JSON.stringify(tBuyer.body)).toBe(200);
    expect(tSeller.body.userId).not.toBe(tBuyer.body.userId);
    expect(tSeller.body.channelId).toBe(`o${seed.orderId}`);
    expect(tSeller.body.token.length).toBeGreaterThan(20);

    // The order's private group exists on Nexconn (created by the server, joinPerm 3).
    const view = await api(baseURL, 'GET', `/api/orders/${seed.orderId}`, seed.sellerKey);
    expect(view.body.order.channel).toMatchObject({ channelId: `o${seed.orderId}`, status: 'ready' });

    await seller.goto(`/o/${seed.orderId}`);
    await buyer.goto(`/o/${seed.orderId}?k=${seed.customerKey}`);
    await expect(pill(seller)).toHaveText('Live', { timeout: 30_000 });
    await expect(pill(buyer)).toHaveText('Live', { timeout: 30_000 });
    await buyer.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: /Chat/ }).click();
  });

  test('2 · real-time text messages in both directions (no reloads)', async () => {
    const s1 = `Seller says hi ${Date.now()}`;
    await seller.getByLabel('Message', { exact: true }).fill(s1);
    await seller.getByRole('button', { name: 'Send message' }).click();
    await expect(chatLog(seller).getByText(s1)).toBeVisible();
    await expect(chatLog(buyer).getByText(s1)).toBeVisible({ timeout: 20_000 });

    const b1 = `Buyer replies ${Date.now()}`;
    await buyer.getByLabel('Message', { exact: true }).fill(b1);
    await buyer.getByLabel('Message', { exact: true }).press('Enter');
    await expect(chatLog(seller).getByText(b1)).toBeVisible({ timeout: 20_000 });
    // Delivery state on the sender's bubble comes from the SDK (sent / read), not from a local guess.
    await expect(chatLog(buyer).getByLabel(/^(Sent|Read)$/).last()).toBeVisible({ timeout: 20_000 });
  });

  test('3 · image message is uploaded through Nexconn and received by the other user', async () => {
    const before = await chatLog(seller).getByRole('img', { name: 'Shared photo' }).count();
    await buyer.getByRole('button', { name: 'Send a photo' }).locator('xpath=preceding-sibling::input[@type="file"]').setInputFiles(PHOTO);
    const received = chatLog(seller).getByRole('img', { name: 'Shared photo' });
    await expect(received).toHaveCount(before + 1, { timeout: 45_000 });
    const src = await received.last().getAttribute('src');
    // Either Nexconn's thumbnail (data: URI from the message content) or its remote file URL — never a local blob.
    expect(src ?? '').toMatch(/^(data:image\/|https:\/\/)/);
    const href = await received.last().locator('xpath=ancestor::a[1]').getAttribute('href');
    expect(href ?? '').toMatch(/^https:\/\//);
  });

  test('4 · BR:* custom events update the other side live, in order, exactly once', async () => {
    // Three domain events in quick succession from the buyer (via the API, like a second device).
    const titles = ['Live order check A', 'Live order check B', 'Live order check C'];
    for (const title of titles) {
      const r = await api(baseURL, 'POST', `/api/orders/${seed.orderId}/clarifications`, seed.customerKey, { title, critical: false });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
    }
    // Seller's workspace refreshes from the BR events (no reload): radar lists them…
    await seller.getByRole('tab', { name: /Radar/ }).click();
    for (const t of titles) await expect(seller.getByText(t).filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
    await seller.getByRole('tab', { name: /Chat/ }).click();
    // …and the chat shows one activity card per event, in the order they happened.
    const cards = chatLog(seller).getByText(/Live order check [ABC]/);
    await expect(cards).toHaveCount(3, { timeout: 30_000 });
    const texts = await cards.allInnerTexts();
    expect(texts.map((t) => t.match(/check ([ABC])/)![1])).toEqual(['A', 'B', 'C']);

    // Server side: every event of this order was delivered once, in seq order, with a Nexconn message ID.
    await expect
      .poll(async () => {
        const v = await api(baseURL, 'GET', `/api/orders/${seed.orderId}`, seed.sellerKey);
        return (v.body.order.activity as Activity[]).filter((a) => a.nexconnStatus !== 'sent').length;
      }, { timeout: 30_000 })
      .toBe(0);
    const v = await api(baseURL, 'GET', `/api/orders/${seed.orderId}`, seed.sellerKey);
    const acts = v.body.order.activity as Activity[];
    const ids = acts.map((a) => a.nexconnMessageId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('5 · idempotent approval replay: one event and one Nexconn message', async () => {
    // Make the brief proposable: a reference image and every required field (price by the seller).
    const up = await fetch(`${baseURL}/api/orders/${seed.orderId}/references`, { method: 'POST', headers: { 'x-key': seed.customerKey, 'content-type': 'image/jpeg' }, body: readFileSync(REFERENCE) });
    expect(up.status).toBe(200);
    const spec = { weight: '1 kg', shape: 'Round', flavour: 'Vanilla', deliveryDate: '2099-12-01', timeSlot: 'Evening (4–8)', fulfilment: 'Pickup' };
    expect((await api(baseURL, 'PATCH', `/api/orders/${seed.orderId}/spec`, seed.customerKey, { spec })).status).toBe(200);
    expect((await api(baseURL, 'PATCH', `/api/orders/${seed.orderId}/spec`, seed.sellerKey, { spec: { price: 1850 } })).status).toBe(200);
    const proposed = await api(baseURL, 'POST', `/api/orders/${seed.orderId}/versions`, seed.sellerKey, { note: 'Live check v1' });
    expect(proposed.status, JSON.stringify(proposed.body)).toBe(200);
    const v1 = (proposed.body.order.versions as { id: string; number: number; snapshotHash: string }[]).find((v) => v.number === 1)!;

    const approve = () => api(baseURL, 'POST', `/api/orders/${seed.orderId}/versions/${v1.id}/decision`, seed.customerKey, { decision: 'approved', snapshotHash: v1.snapshotHash }, { 'idempotency-key': `live-approve-${v1.id}` });
    const r1 = await approve();
    const r2 = await approve(); // a client retry with the same key (e.g. the first response was lost)
    expect(r1.status, JSON.stringify(r1.body)).toBe(200);
    expect(r2.status, JSON.stringify(r2.body)).toBe(200);
    expect(r2.body.result.replayed).toBe(true);
    expect((r2.body.order.activity as Activity[]).filter((a) => a.type === 'VERSION_APPROVED')).toHaveLength(1);

    // Exactly one approval card reaches the seller over Nexconn — no duplicate delivery.
    const card = chatLog(seller).getByText(/approved version 1/);
    await expect(card).toHaveCount(1, { timeout: 30_000 });
    await seller.waitForTimeout(4000);
    await expect(card).toHaveCount(1);
  });

  test('6 · history is loaded from the Nexconn server after a reload', async () => {
    await seller.reload();
    await expect(pill(seller)).toHaveText('Live', { timeout: 30_000 });
    await expect(chatLog(seller).getByText(/Seller says hi/)).toBeVisible({ timeout: 30_000 });
    await expect(chatLog(seller).getByText(/Buyer replies/)).toBeVisible();
    await expect(chatLog(seller).getByRole('img', { name: 'Shared photo' }).first()).toBeVisible();
    const cards = chatLog(seller).getByText(/Live order check [ABC]/);
    await expect(cards).toHaveCount(3);
    expect((await cards.allInnerTexts()).map((t) => t.match(/check ([ABC])/)![1])).toEqual(['A', 'B', 'C']);
    await expect(chatLog(seller).getByText(/approved version 1/)).toHaveCount(1);
  });

  test('7 · reconnection: a message sent while the buyer is offline arrives after reconnect', async () => {
    networkDrop = true;
    await buyerCtx.setOffline(true);
    await expect(pill(buyer)).not.toHaveText('Live', { timeout: 45_000 });
    const missed = `Sent while you were offline ${Date.now()}`;
    await seller.getByLabel('Message', { exact: true }).fill(missed);
    await seller.getByRole('button', { name: 'Send message' }).click();
    await expect(chatLog(seller).getByText(missed)).toBeVisible();
    await buyerCtx.setOffline(false);
    await expect(pill(buyer)).toHaveText('Live', { timeout: 60_000 });
    await expect(chatLog(buyer).getByText(missed)).toBeVisible({ timeout: 45_000 });
    await buyer.waitForTimeout(1000);
    networkDrop = false;
  });

  test('8 · seller inbox (Nexconn Chat UI) lists the order conversation and renders BR:* cards', async () => {
    // Nexconn keeps one web session per user: close the seller's workspace before the inbox connects as the same user.
    await seller.close();
    const inbox = await sellerCtx.newPage();
    watch(inbox, 'inbox', problems);
    await inbox.goto(`/seller/${seed.shopId}`);
    await inbox.getByRole('button', { name: 'Messages', exact: true }).filter({ visible: true }).click();
    // Chat UI renders the channel name as a bare text node inside <nc-channel-label>'s shadow root (CSS
    // ellipsis), which text selectors do not match — read it through the shadow root instead.
    const shadowText = (sel: string) => inbox.locator(sel).evaluateAll((els) => els.map((e) => (e.shadowRoot ?? e).textContent ?? '').join('\n'));
    await expect.poll(() => shadowText('nc-channel-label'), { timeout: 45_000 }).toContain('Live sync check cake');
    await expect(inbox.locator('nc-channel-list-item').first()).toBeVisible();
    await inbox.locator('nc-channel-list-item').first().click();
    // BR:* custom messages render through BriefRoom's component, which Chat UI registers with its `nc-c-`
    // prefix (<nc-c-br-activity>); plain text messages render as normal bubbles.
    const card = 'nc-c-br-activity, br-activity';
    await expect.poll(() => shadowText(card), { timeout: 30_000 }).toMatch(/approved version 1/);
    await expect(inbox.locator(card).first()).toBeVisible();
    await expect(inbox.getByText(/Sent while you were offline/).first()).toBeVisible({ timeout: 30_000 });
    await inbox.close();
  });

  test('9 · no page errors on either side', async () => {
    if (vendorNoise) test.info().annotations.push({ type: 'vendor-noise', description: `${vendorNoise} console errors from the Nexconn SDK's own log upload to logcollection.ronghub.com (CORS) — see e2e/support/console.ts` });
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
