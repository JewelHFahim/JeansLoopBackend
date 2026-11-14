import Redis from 'ioredis';
import { env } from '../config/env';

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

/**
 * Enterprise-grade Hybrid Caching Service.
 * - If REDIS_URL is configured, connects to Redis with reconnection resilience.
 * - If Redis is not configured or temporarily unreachable, gracefully falls back to local in-memory caching.
 * - Zero downtime, zero code changes needed between local dev and VPS production.
 */
class CacheService {
  private redis: Redis | null = null;
  private isRedisReady = false;
  private memoryStore = new Map<string, CacheItem<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initRedis();

    // In-memory GC runs every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.evictExpiredMemory();
    }, 2 * 60 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private initRedis() {
    const redisUrl = env.REDIS_URL || process.env.REDIS_URL;

    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableReadyCheck: true,
          retryStrategy: (times) => {
            if (times > 5) {
              console.warn('[Cache] Redis connection failed after 5 retries. Falling back to in-memory store.');
              return null;
            }
            return Math.min(times * 1000, 3000);
          },
        });

        this.redis.on('connect', () => {
          this.isRedisReady = true;
          console.log('⚡  Redis cache connected successfully.');
        });

        this.redis.on('error', (err) => {
          this.isRedisReady = false;
          console.warn('[Cache] Redis error, operating in memory-fallback mode:', err.message);
        });

        this.redis.connect().catch(() => {
          this.isRedisReady = false;
          console.warn('[Cache] Initial Redis connection failed. Operating with in-memory caching.');
        });
      } catch (err: any) {
        this.isRedisReady = false;
        console.warn('[Cache] Redis initialization error:', err?.message || err);
      }
    } else {
      console.log('ℹ️   Redis URL not provided. Running high-performance in-memory cache.');
    }
  }

  /**
   * Retrieve item from Redis or in-memory fallback
   */
  public async get<T>(key: string): Promise<T | null> {
    if (this.isRedisReady && this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw) {
          return JSON.parse(raw) as T;
        }
        return null;
      } catch (err) {
        console.warn(`[Cache] Error reading key "${key}" from Redis:`, err);
      }
    }

    const item = this.memoryStore.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }

    return item.value as T;
  }

  /**
   * Set item in Redis and in-memory fallback with TTL in seconds
   */
  public async set<T>(key: string, value: T, ttlSeconds = 120): Promise<void> {
    // Write to in-memory store
    this.memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    if (this.isRedisReady && this.redis) {
      try {
        const serialized = JSON.stringify(value);
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
      } catch (err) {
        console.warn(`[Cache] Error saving key "${key}" to Redis:`, err);
      }
    }
  }

  /**
   * Delete specific key from both caches
   */
  public async del(key: string): Promise<void> {
    this.memoryStore.delete(key);

    if (this.isRedisReady && this.redis) {
      try {
        await this.redis.del(key);
      } catch (err) {
        console.warn(`[Cache] Error deleting key "${key}" in Redis:`, err);
      }
    }
  }

  /**
   * Invalidate all keys matching a prefix (e.g. "product:", "categories:")
   */
  public async invalidatePrefix(prefix: string): Promise<void> {
    // Clear in memory
    for (const key of this.memoryStore.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryStore.delete(key);
      }
    }

    // Clear in Redis via SCAN (non-blocking)
    if (this.isRedisReady && this.redis) {
      try {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
          cursor = nextCursor;
          if (keys && keys.length > 0) {
            await this.redis.del(...keys);
          }
        } while (cursor !== '0');
      } catch (err) {
        console.warn(`[Cache] Error invalidating prefix "${prefix}" in Redis:`, err);
      }
    }
  }

  /**
   * Flush entire cache
   */
  public async clear(): Promise<void> {
    this.memoryStore.clear();
    if (this.isRedisReady && this.redis) {
      try {
        await this.redis.flushdb();
      } catch (err) {
        console.warn('[Cache] Error flushing Redis DB:', err);
      }
    }
  }

  private evictExpiredMemory(): void {
    const now = Date.now();
    for (const [key, item] of this.memoryStore.entries()) {
      if (now > item.expiresAt) {
        this.memoryStore.delete(key);
      }
    }
  }
}

export const cache = new CacheService();
