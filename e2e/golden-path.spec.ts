/**
 * Golden path (BriefRoom 2.0 brief, Phase 9): seller on a desktop browser, buyer on a mobile
 * browser — two independent contexts — from an empty shop to an AGREED work order.
 *
 * Without Nexconn credentials (default) the other participant sees changes after a reload;
 * with E2E_NEXCONN=1 the same steps also run over real Nexconn live sync.
 */
import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { isVendorTelemetryNoise } from './support/console';

const REFERENCE =join(process.cwd(), 'public/images/reference-berry-cake.jpg');

function watch(page: Page, label: string, problems: string[]) {
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text()) && !isVendorTelemetryNoise(m) && problems.push(`[${label}] console: ${m.text()}`));
}
async function noOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `horizontal overflow on ${where}`).toBeLessThanOrEqual(1);
}

test('seller (desktop) and buyer (mobile) agree on version 2 and get a work order', async ({ browser, baseURL }) => {
  const problems: string[] = [];
  const sellerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const buyerCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const seller = await sellerCtx.newPage();
  const buyer = await buyerCtx.newPage();
  watch(seller, 'seller', problems);
  watch(buyer, 'buyer', problems);

  // 1. Seller creates a shop.
  await seller.goto('/start');
  await seller.getByLabel('Shop name').fill('Sugar & Sprinkles');
  await seller.getByLabel('Your name').fill('Neha');
  await seller.getByLabel('City').fill('Pune');
  await seller.getByRole('button', { name: 'Create my shop' }).click();
  await expect(seller.getByText('Your shop is ready')).toBeVisible();
  await seller.getByRole('button', { name: 'Open dashboard' }).click();
  await expect(seller.getByRole('heading', { name: 'Orders' })).toBeVisible();
  await expect(seller.getByText('No briefs yet')).toBeVisible();

  // 2. Seller creates an order room.
  await seller.getByRole('button', { name: 'New brief' }).click();
  await seller.getByRole('dialog').getByLabel('Customer name').fill('Priya');
  await seller.getByRole('dialog').getByLabel('Title').fill("Aditi's 25th birthday cake");
  await seller.getByRole('button', { name: 'Create brief room' }).click();
  await expect(seller.getByText('Brief room ready for Priya')).toBeVisible();
  const link = (await seller.getByRole('dialog').locator('p.font-mono').innerText()).trim();
  const orderId = new URL(link).pathname.split('/')[2];
  const sellerKey = await seller.evaluate(() => Object.entries(localStorage).find(([k]) => k.startsWith('br.seller.'))![1]);
  await seller.keyboard.press('Escape');

  // 3. The backend reserved the order's private Nexconn group channel (created on Nexconn when keys are set).
  const view0 = await (await fetch(`${baseURL}/api/orders/${orderId}`, { headers: { 'x-key': sellerKey } })).json();
  expect(view0.order.channel.channelId).toBe(`o${orderId}`);
  expect(['ready', 'pending', 'disabled']).toContain(view0.order.channel.status);
  expect(view0.order.activity.map((a: { type: string }) => a.type)).toContain('ORDER_CREATED');

  // 4. Buyer opens the share link on a phone. 5. Uploads a reference.
  await buyer.goto(new URL(link).pathname + new URL(link).search);
  await expect(buyer.getByRole('heading', { name: "Aditi's 25th birthday cake" })).toBeVisible();
  await expect(buyer).not.toHaveURL(/k=/); // the private key is stripped from the address bar
  await buyer.locator('input[type=file][multiple]').setInputFiles(REFERENCE);
  await expect(buyer.getByText('Reference added')).toBeVisible();
  await noOverflow(buyer, 'buyer workspace (390px)');

  // 6. Buyer marks the flower/berry region and asks for ivory roses.
  await buyer.getByRole('radio', { name: /Draw a box/ }).click();
  const stage = buyer.locator('img[alt^="Reference"]').locator('xpath=..');
  const box = (await stage.boundingBox())!;
  await stage.click({ position: { x: box.width * 0.48, y: box.height * 0.32 } });
  const composer = buyer.getByRole('dialog', { name: 'New annotation' });
  await composer.getByRole('radio', { name: /^Colour/ }).click();
  await composer.getByLabel(/Which colour should this be/).fill('Can we change these to ivory roses?');
  await composer.getByRole('button', { name: 'Save & send' }).click();
  await expect(buyer.getByText(/Marked #1/)).toBeVisible();
  await buyer.keyboard.press('Escape');

  // 7. Seller receives the update. 8. Seller replies in the region's discussion.
  await seller.goto(`/o/${orderId}`);
  const item = seller.getByRole('button', { name: /Can we change these to ivory roses/ }).first();
  await expect(item).toBeVisible();
  await item.click();
  await seller.getByLabel('Reply about annotation 1').fill('Should I keep the leaves green?');
  await seller.getByLabel('Reply about annotation 1').press('Enter');
  await expect(seller.getByText('Should I keep the leaves green?')).toBeVisible();

  // 9. Buyer confirms in the same thread and asks to mark it resolved; seller confirms (two-party resolution).
  await buyer.reload();
  await buyer.getByRole('button', { name: /Can we change these to ivory roses/ }).first().click();
  const thread = buyer.getByRole('dialog', { name: 'Annotation #1' });
  await expect(thread.getByText('Should I keep the leaves green?')).toBeVisible();
  await thread.getByLabel('Reply about annotation 1').fill('Yes, keep them green.');
  await thread.getByLabel('Reply about annotation 1').press('Enter');
  await expect(thread.getByText('Yes, keep them green.')).toBeVisible();
  await thread.getByRole('button', { name: 'Mark resolved' }).click();
  await expect(thread.getByText(/Waiting for .* to confirm/)).toBeVisible();
  await buyer.keyboard.press('Escape');
  await seller.reload();
  await seller.getByRole('button', { name: /Can we change these to ivory roses/ }).first().click();
  await seller.getByRole('button', { name: 'Confirm resolved' }).click();
  await expect(seller.getByText(/Resolved — confirmed by you/)).toBeVisible();

  // 10. Clarification Radar + ambiguity check find missing details; seller asks the customer.
  await seller.getByRole('tab', { name: /To-do/ }).click();
  await seller.getByRole('button', { name: 'Check the brief' }).click();
  const sizeSuggestion = seller.locator('article').filter({ hasText: /exact size/i }).first();
  await expect(sizeSuggestion).toBeVisible();
  await expect(sizeSuggestion.getByText('Rules check')).toBeVisible();
  await sizeSuggestion.getByRole('button', { name: /Ask the customer/ }).click();
  await expect(seller.getByText('Blocks next version').first()).toBeVisible();

  // 11. Buyer resolves the critical clarification with an answer.
  await buyer.reload();
  await buyer.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: /To-do/ }).click();
  await buyer.getByLabel(/Answer that resolves it/).first().fill('1 kg please');
  await buyer.getByRole('button', { name: 'Resolve' }).first().click();
  await expect(buyer.getByText('1 kg please').first()).toBeVisible();
  // Critical item resolved → status leaves "Questions open" (the visible badge is in the mobile status strip).
  await expect(buyer.getByText('Collecting details').filter({ visible: true }).first()).toBeVisible();
  await noOverflow(buyer, 'buyer radar');

  // 12. Seller completes the specification (incl. the seller-only price).
  await seller.reload();
  await seller.getByRole('tab', { name: /Details/ }).click();
  await seller.getByLabel('Size / weight').selectOption('1 kg');
  await seller.getByLabel('Shape').selectOption('Round');
  await seller.getByLabel('Flavour').selectOption('Vanilla');
  await seller.getByLabel('Needed on').fill('2026-12-15');
  await seller.getByLabel('Time slot').selectOption('Evening (4–8)');
  await seller.getByLabel('Pickup or delivery').selectOption('Pickup');
  await seller.getByLabel('Quoted price (₹)').fill('1850');
  await seller.getByRole('button', { name: 'Save & notify' }).click();
  await expect(seller.getByText('All changes saved')).toBeVisible();

  // 13. Seller proposes version 1.
  await seller.getByRole('button', { name: 'Send for approval' }).click();
  await seller.getByRole('button', { name: 'Freeze & send version 1' }).click();
  await expect(seller.getByText('Version 1 needs both approvals')).toBeVisible();

  // 14. Buyer requests a change.
  await buyer.reload();
  await buyer.getByRole('button', { name: 'Review & approve version 1' }).click();
  await buyer.getByRole('button', { name: 'Request changes' }).click();
  await buyer.getByLabel('Requested changes').fill('Make it 1.5 kg please');
  await buyer.getByRole('button', { name: 'Send change request' }).click();
  await expect(buyer.getByText('Changes requested on version 1')).toBeVisible();

  // 15. Seller updates the brief and proposes version 2.
  await seller.reload();
  await seller.getByRole('tab', { name: /Details/ }).click();
  await seller.getByLabel('Size / weight').selectOption('1.5 kg');
  await seller.getByLabel('Quoted price (₹)').fill('2400');
  await seller.getByRole('button', { name: 'Save & notify' }).click();
  await expect(seller.getByText('All changes saved')).toBeVisible();
  await seller.getByRole('button', { name: 'Send for approval' }).click();
  await seller.getByRole('button', { name: 'Freeze & send version 2' }).click();
  await expect(seller.getByText('Version 2 needs both approvals')).toBeVisible();

  // 16. Buyer reviews the visual diff (computed from the stored v1 and v2 snapshots).
  await buyer.reload();
  await buyer.getByRole('button', { name: 'Review & approve version 2' }).click();
  const diffTable = buyer.getByRole('table', { name: /Specification and annotation changes/ });
  await expect(diffTable.getByRole('cell', { name: '1.5 kg' })).toBeVisible();
  await expect(diffTable.getByRole('cell', { name: '₹2,400' })).toBeVisible();
  await noOverflow(buyer, 'buyer versions');

  // 17. Buyer approves version 2.
  await buyer.getByRole('button', { name: 'Approve version 2' }).first().click();
  await buyer.getByRole('dialog').getByRole('button', { name: 'Approve version 2' }).click();
  await expect(buyer.getByText(/You approved this version/)).toBeVisible();

  // 18. Seller approves the same version.
  await seller.reload();
  await seller.getByRole('button', { name: 'Review & approve', exact: true }).click();
  await seller.getByRole('button', { name: 'Approve version 2' }).first().click();
  await seller.getByRole('dialog').getByRole('button', { name: 'Approve version 2' }).click();

  // 20. Order AGREED (shown only because the backend confirmed both approvals).
  await expect(seller.getByText('Order agreed').first()).toBeVisible();

  // 19. Backend verified both approvals against the same version ID and SHA-256 hash.
  const view = await (await fetch(`${baseURL}/api/orders/${orderId}`, { headers: { 'x-key': sellerKey } })).json();
  const v2 = view.order.versions.find((v: { number: number }) => v.number === 2);
  expect(view.order.status).toBe('agreed');
  expect(view.order.agreedVersionId).toBe(v2.id);
  expect(v2.approvals.map((a: { role: string; snapshotHash: string; decision: string }) => [a.role, a.decision, a.snapshotHash]).sort()).toEqual([
    ['customer', 'approved', v2.snapshotHash],
    ['seller', 'approved', v2.snapshotHash],
  ]);
  expect(view.order.versions[0].status).toBe('changes_requested');

  // 21. Work order is generated with the full fingerprint, verifiable in the browser.
  await seller.getByRole('link', { name: 'Open the work order' }).click();
  await expect(seller.getByText(v2.snapshotHash).first()).toBeVisible();
  await seller.getByRole('button', { name: 'Verify fingerprint' }).click();
  await expect(seller.getByText('Verified in your browser')).toBeVisible();

  // The buyer sees the agreement too (phone: Versions tab).
  await buyer.reload();
  await buyer.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: /Approve/ }).click();
  await expect(buyer.getByText('Order agreed').first()).toBeVisible();
  await noOverflow(buyer, 'buyer agreement');

  expect(problems, problems.join('\n')).toEqual([]);
  await sellerCtx.close();
  await buyerCtx.close();
});
