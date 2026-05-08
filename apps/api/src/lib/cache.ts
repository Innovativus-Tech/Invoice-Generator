import { redis } from './redis.js';

const DEFAULT_TTL = 300; // 5 minutes

export const CacheKeys = {
  clients: (orgId: string) => `clients:${orgId}`,
  client: (orgId: string, id: string) => `client:${orgId}:${id}`,
  inventory: (orgId: string) => `inventory:${orgId}`,
  invoices: (orgId: string) => `invoices:${orgId}`,
  dashboardStats: (orgId: string) => `dashboard:stats:${orgId}`,
  revenueChart: (orgId: string, period: string) => `dashboard:revenue:${orgId}:${period}`,
  settings: (orgId: string) => `settings:${orgId}`,
  nextInvoiceNumber: (orgId: string) => `invoice:next:${orgId}`,
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // cache write failure is non-fatal
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // cache delete failure is non-fatal
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // non-fatal
  }
}
