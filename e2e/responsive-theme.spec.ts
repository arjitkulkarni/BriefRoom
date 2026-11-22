/**
 * Theme switching (Light / Dark / System, persisted, no flash) and responsive layouts
 * (no horizontal overflow, no console errors) across the key screens in both themes.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isVendorTelemetryNoise } from './support/console';

const WIDTHS = [1440, 1280, 1024, 768, 390, 360];

async function seed(request: APIRequestContext) {
  const shop = await (await request.post('/api/shops', { data: { name: 'Studio North', ownerName: 'Neha', category: 'cake', city: 'Pune' } })).json();
  const order = await (await request.post(`/api/shops/${shop.shop.id}/orders`, { data: { customerName: 'Priya', title: 'Birthday cake', template: 'cake' }, headers: { 'x-key': shop.sellerKey } })).json();
  const up = await (
    await request.post(`/api/orders/${order.orderId}/references`, { data: readFileSync(join(process.cwd(), 'public/images/reference-berry-cake.jpg')), headers: { 'x-key': order.customerKey, 'content-type': 'image/jpeg' } })
  ).json();
  const refId = up.order.references[0].id;
  await request.post(`/api/orders/${order.orderId}/annotations`, { data: { referenceId: refId, kind: 'colour', note: 'Ivory roses instead', color: '#f4ebd9', x: 0.23, y: 0.23, w: 0.5, h: 0.18 }, headers: { 'x-key': order.customerKey } });
  await request.post(`/api/orders/${order.orderId}/annotations`, { data: { referenceId: refId, kind: 'question', shape: 'point', note: 'Sugar leaves?', x: 0.43, y: 0.445 }, headers: { 'x-key': shop.sellerKey } });
  return { shopId: shop.shop.id as string, sellerKey: shop.sellerKey as string, orderId: order.orderId as string, customerKey: order.customerKey as string };
}

async function visit(page: Page, path: string, problems: string[]) {
  page.on('pageerror', (e) => problems.push(`${path}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !isVendorTelemetryNoise(m) && problems.push(`${path}: ${m.text()}`));
  await page.goto(path, { waitUntil: 'networkidle' });
}

test('theme: explicit choice persists and is applied before first paint; System follows the OS', async ({ page, browser }) => {
  await page.goto('/');
  const toggle = page.getByRole('switch', { name: 'Dark theme' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  // Reload and read the attribute at DOMContentLoaded — set by the inline script, before React runs.
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(11, 10, 9)');

  // System: no stored choice → follows prefers-color-scheme.
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const p2 = await ctx.newPage();
  await p2.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await p2.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await ctx.close();
  const ctxLight = await browser.newContext({ colorScheme: 'light' });
  const p3 = await ctxLight.newPage();
  await p3.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await p3.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await ctxLight.close();
});

test('no horizontal overflow or console errors on key screens, at every breakpoint, in both themes', async ({ browser, request }) => {
  const s = await seed(request);
  const problems: string[] = [];
  const screens: { path: string; store: Record<string, string> }[] = [
    { path: '/', store: {} },
    { path: '/start', store: {} },
    { path: `/shop/${s.shopId}`, store: {} },
    { path: `/seller/${s.shopId}`, store: { [`br.seller.${s.shopId}`]: s.sellerKey } },
    { path: `/o/${s.orderId}`, store: { [`br.customer.${s.orderId}`]: s.customerKey } },
    { path: '/design-system', store: {} },
  ];
  for (const theme of ['light', 'dark'] as const) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 860 }, isMobile: width < 768, hasTouch: width < 768 });
      await ctx.addInitScript(
        ([t, all]) => {
          localStorage.setItem('br.theme', t);
          for (const st of all) for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v);
        },
        [theme, screens.map((x) => x.store)] as const,
      );
      const page = await ctx.newPage();
      for (const sc of screens) {
        await visit(page, sc.path, problems);
        expect(await page.evaluate(() => document.documentElement.dataset.theme), `${sc.path} theme`).toBe(theme);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${sc.path} overflows by ${overflow}px at ${width}px (${theme})`).toBeLessThanOrEqual(1);
      }
      await ctx.close();
    }
  }
  expect(problems, problems.join('\n')).toEqual([]);
});

test('touch targets on the mobile workspace are at least 40px', async ({ browser, request }) => {
  const s = await seed(request);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`br.customer.${s.orderId}`, s.customerKey] as const);
  const page = await ctx.newPage();
  await page.goto(`/o/${s.orderId}`, { waitUntil: 'networkidle' });
  const nav = page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button');
  for (const b of await nav.all()) {
    const box = (await b.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(40);
    expect(box.width).toBeGreaterThanOrEqual(40);
  }
  await ctx.close();
});
