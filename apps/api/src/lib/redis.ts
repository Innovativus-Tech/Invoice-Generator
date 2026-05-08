import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

function createRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[Redis] REDIS_URL not set — caching disabled');
    return null;
  }

  const client = new Redis(url, {
    tls: { rejectUnauthorized: false },
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
