import type { ConsoleMessage } from '@playwright/test';

/**
 * Known third-party console noise that is NOT BriefRoom behaviour (found in the live run on 2026-11-22):
 * the Nexconn Chat SDK uploads its diagnostics to the log collector named in Nexconn's server-side
 * configuration (logcollection.ronghub.com — the URL is not in the SDK bundle). That host's CORS
 * preflight rejects the SDK's own `X-User-Agent` header, so the browser logs a CORS error plus a
 * failed resource load. The public SDK API (NCEngine.initialize: appKey, logLevel, areaCode) has no
 * switch for this upload. Only this exact host is ignored; every other console error still fails a test.
 */
const VENDOR_LOG_COLLECTOR = /^https:\/\/logcollection\.ronghub\.com\//;

export function isVendorTelemetryNoise(m: ConsoleMessage): boolean {
  return /Access to XMLHttpRequest at 'https:\/\/logcollection\.ronghub\.com\//.test(m.text()) || VENDOR_LOG_COLLECTOR.test(m.location().url ?? '');
}
