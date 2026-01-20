import { createClient, RedisClientType } from 'redis';

// Redis URL from environment or default to K8s service
const REDIS_URL = process.env.REDIS_URL || 'redis://redis.redis-system.svc.cluster.local:6379';

let redisClient: RedisClientType | null = null;
let isConnecting = false;
let connectionPromise: Promise<RedisClientType> | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  isConnecting = true;
  connectionPromise = (async () => {
    try {
      redisClient = createClient({ url: REDIS_URL });

      redisClient.on('error', (err) => {
        console.error('[Redis] Connection error:', err.message);
      });

      redisClient.on('reconnecting', () => {
        console.log('[Redis] Reconnecting...');
      });

      await redisClient.connect();
      console.log('[Redis] Connected successfully');
      return redisClient;
    } catch (error) {
      console.error('[Redis] Failed to connect:', error);
      throw error;
    } finally {
      isConnecting = false;
    }
  })();

  return connectionPromise;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Connection closed');
  }
}

// Cache utilities with service prefix
export class CacheService {
  private prefix: string;
  private defaultTTL: number;

  constructor(servicePrefix: string, defaultTTL: number = 60) {
    this.prefix = servicePrefix;
    this.defaultTTL = defaultTTL;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getRedisClient();
      const value = await client.get(this.getKey(key));
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[Cache] Get error for ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const client = await getRedisClient();
      await client.setEx(
        this.getKey(key),
        ttl ?? this.defaultTTL,
        JSON.stringify(value)
      );
    } catch (error) {
      console.error(`[Cache] Set error for ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      const client = await getRedisClient();
      await client.del(this.getKey(key));
    } catch (error) {
      console.error(`[Cache] Delete error for ${key}:`, error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const client = await getRedisClient();
      const keys = await client.keys(this.getKey(pattern));
      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (error) {
      console.error(`[Cache] Delete pattern error for ${pattern}:`, error);
    }
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }

  // Batch get for multiple keys
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const client = await getRedisClient();
      const fullKeys = keys.map(k => this.getKey(k));
      const values = await client.mGet(fullKeys);
      return values.map(v => (v ? JSON.parse(v) : null));
    } catch (error) {
      console.error('[Cache] MGet error:', error);
      return keys.map(() => null);
    }
  }

  // Batch set for multiple key-value pairs
  async mset<T>(entries: { key: string; value: T; ttl?: number }[]): Promise<void> {
    try {
      const client = await getRedisClient();
      const pipeline = client.multi();

      for (const { key, value, ttl } of entries) {
        pipeline.setEx(this.getKey(key), ttl ?? this.defaultTTL, JSON.stringify(value));
      }

      await pipeline.exec();
    } catch (error) {
      console.error('[Cache] MSet error:', error);
    }
  }
}

// Pre-configured cache instances for each service
export const authCache = new CacheService('auth', 300); // 5 min
export const blogCache = new CacheService('blog', 60);  // 1 min
export const commentCache = new CacheService('comment', 60);
export const pageCache = new CacheService('page', 120); // 2 min
export const analyticsCache = new CacheService('analytics', 300); // 5 min
export const storageCache = new CacheService('storage', 60);
