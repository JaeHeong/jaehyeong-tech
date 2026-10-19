import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis.redis-system.svc.cluster.local:6379';
const ENV_PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const PROJECT_PREFIX = process.env.CACHE_NAMESPACE || 'jaehyeong-tech';
const COMMAND_TIMEOUT_MS = Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 150);
const RETRY_DELAY_MS = Number(process.env.REDIS_RETRY_DELAY_MS || 5000);
let redisClient: RedisClientType | null = null;
let connecting = false;
let retryAfter = 0;
let stopped = false;

function discard(client: RedisClientType) {
  if (redisClient === client) {
    redisClient = null;
    retryAfter = Date.now() + RETRY_DELAY_MS;
    connecting = false;
  }
  if (client.isOpen) void client.disconnect().catch(() => {});
}

// Connect in the background. Requests never wait for Redis to come back online.
export async function getRedisClient(): Promise<RedisClientType> {
  if (!stopped && Date.now() >= retryAfter && redisClient?.isReady) return redisClient;
  if (!stopped && !connecting && Date.now() >= retryAfter) {
    connecting = true;
    const client: RedisClientType = createClient({
      url: REDIS_URL,
      socket: { connectTimeout: 300, reconnectStrategy: false },
      disableOfflineQueue: true,
      commandsQueueMaxLength: 100,
    });
    redisClient = client;
    client.on('error', () => { discard(client); });
    void client.connect().then(() => {
      connecting = false;
      if (redisClient !== client || stopped) { discard(client); return; }
      client.unref();
    }).catch(() => { discard(client); });
  }
  throw new Error('Cache unavailable');
}

export async function closeRedisConnection(): Promise<void> {
  stopped = true;
  const client = redisClient;
  redisClient = null;
  if (client?.isOpen) await client.disconnect();
}

async function cached<T>(operation: (client: RedisClientType) => Promise<T>, fallback: T): Promise<T> {
  let client: RedisClientType | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    client = await getRedisClient();
    const activeClient = client;
    return await Promise.race([
      Promise.resolve().then(() => operation(activeClient)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          discard(activeClient);
          reject(new Error('Cache deadline exceeded'));
        }, COMMAND_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Cache failures never fail the underlying operation or hold up responses.
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class CacheService {
  constructor(private prefix: string, private defaultTTL: number = 60) {}

  private getKey(key: string): string {
    return `${PROJECT_PREFIX}:${ENV_PREFIX}:${this.prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    return cached(async client => {
      const value = await client.get(this.getKey(key));
      return value ? JSON.parse(value) as T : null;
    }, null);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await cached(async client => {
      await client.setEx(this.getKey(key), ttl ?? this.defaultTTL, JSON.stringify(value));
    }, undefined);
  }

  async del(key: string): Promise<void> {
    await cached(async client => { await client.del(this.getKey(key)); }, undefined);
  }

  async delPattern(pattern: string): Promise<void> {
    await cached(async client => {
      for await (const key of client.scanIterator({ MATCH: this.getKey(pattern), COUNT: 100 })) {
        await client.del(key);
      }
    }, undefined);
  }

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const value = await this.get<T>(key);
    if (value !== null) return value;
    const result = await fetcher();
    await this.set(key, result, ttl);
    return result;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!keys.length) return [];
    return cached(async client => {
      const values = await client.mGet(keys.map(key => this.getKey(key)));
      return values.map(value => value ? JSON.parse(value) as T : null);
    }, keys.map(() => null));
  }

  async mset<T>(entries: { key: string; value: T; ttl?: number }[]): Promise<void> {
    if (!entries.length) return;
    await cached(async client => {
      const pipeline = client.multi();
      for (const entry of entries) pipeline.setEx(this.getKey(entry.key), entry.ttl ?? this.defaultTTL, JSON.stringify(entry.value));
      await pipeline.exec();
    }, undefined);
  }
}

export const authCache = new CacheService('auth', 300);
export const blogCache = new CacheService('blog', 60);
export const commentCache = new CacheService('comment', 60);
export const pageCache = new CacheService('page', 120);
export const analyticsCache = new CacheService('analytics', 300);
export const storageCache = new CacheService('storage', 60);
