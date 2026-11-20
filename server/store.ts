/**
 * JSON-file store with debounced atomic writes. Fine for one instance with a persistent disk.
 * Swap for Postgres to scale horizontally - all access goes through `db`.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BriefContent, Version } from '../shared/types.ts';

export interface ShopRecord {
  id: string;
  name: string;
  owner: string;
  category: string;
  city: string;
  sellerUserId: string;
  sellerKey: string;
  createdAt: number;
}

export interface OrderRecord {
  id: string;
  shopId: string;
  template: string;
  title: string;
  customerName: string;
  customerUserId: string;
  customerKey: string;
  channelId: string;
  createdAt: number;
  updatedAt: number;
  draft: BriefContent;
  versions: Version[];
  agreedVersion: number | null;
  pinCounter: number;
}

interface DB {
  shops: Record<string, ShopRecord>;
  orders: Record<string, OrderRecord>;
  names: Record<string, string>; // Nexconn userId -> display name (Chat UI hooks)
  visits: { orderId: string; role: string; at: number }[];
}

export const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
export const UPLOAD_DIR = join(DATA_DIR, 'uploads');
const FILE = join(DATA_DIR, 'db.json');

function load(): DB {
  const empty: DB = { shops: {}, orders: {}, names: {}, visits: [] };
  try {
    if (existsSync(FILE)) return { ...empty, ...JSON.parse(readFileSync(FILE, 'utf8')) };
  } catch (err) {
    console.error('[store] could not read db, starting empty', err);
  }
  return empty;
}

export const db: DB = load();
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

let timer: NodeJS.Timeout | null = null;
export function persist() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    try {
      const tmp = FILE + '.tmp';
      writeFileSync(tmp, JSON.stringify(db));
      renameSync(tmp, FILE);
    } catch (err) {
      console.error('[store] write failed', err);
    }
  }, 250);
}
