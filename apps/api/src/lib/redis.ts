import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

function createRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[Redis] REDIS_URL not set — caching disabled');
    return null;
  }

  // Only enable TLS when the URL explicitly opts in via `rediss://`.
  // The previous unconditional `tls` option broke plain Redis (local
  // Docker, Coolify's internal Redis) by forcing a TLS handshake on a
  // server that doesn't speak TLS.
  const useTls = url.startsWith('rediss://');
  const client = new Redis(url, {
    ...(useTls ? { tls: { rejectUnauthorized: false } } : {}),
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on('error', (err) => {
    console.warn('[Redis] connection error:', err.message);
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedis();
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis ?? undefined;
