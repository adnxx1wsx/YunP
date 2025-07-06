import Redis from 'redis';
import { log } from './logger';

// 内存缓存实现
class MemoryCache {
  private cache = new Map<string, { value: any; expiry: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 每5分钟清理过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  set(key: string, value: any, ttlSeconds: number = 3600): void {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      log.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Redis 缓存实现
class RedisCache {
  private client: any;
  private connected: boolean = false;

  constructor() {
    if (process.env.REDIS_URL) {
      this.initRedis();
    }
  }

  private async initRedis(): Promise<void> {
    try {
      this.client = Redis.createClient({
        url: process.env.REDIS_URL,
        password: process.env.REDIS_PASSWORD,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      this.client.on('error', (err: Error) => {
        log.error('Redis connection error:', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        log.info('Redis connected successfully');
        this.connected = true;
      });

      this.client.on('disconnect', () => {
        log.warn('Redis disconnected');
        this.connected = false;
      });

      await this.client.connect();
    } catch (error) {
      log.error('Failed to initialize Redis:', error);
      this.connected = false;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    if (!this.connected) return;

    try {
      const serializedValue = JSON.stringify(value);
      await this.client.setEx(key, ttlSeconds, serializedValue);
    } catch (error) {
      log.error('Redis set error:', error);
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.connected) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      log.error('Redis get error:', error);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      log.error('Redis delete error:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.flushDb();
    } catch (error) {
      log.error('Redis clear error:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      log.error('Redis exists error:', error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.disconnect();
    }
  }
}

// 缓存管理器
class CacheManager {
  private memoryCache: MemoryCache;
  private redisCache: RedisCache;

  constructor() {
    this.memoryCache = new MemoryCache();
    this.redisCache = new RedisCache();
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    // 优先使用 Redis，回退到内存缓存
    if (this.redisCache.isConnected()) {
      await this.redisCache.set(key, value, ttlSeconds);
    } else {
      this.memoryCache.set(key, value, ttlSeconds);
    }
  }

  async get(key: string): Promise<any | null> {
    // 优先从 Redis 获取，回退到内存缓存
    if (this.redisCache.isConnected()) {
      return await this.redisCache.get(key);
    } else {
      return this.memoryCache.get(key);
    }
  }

  async delete(key: string): Promise<boolean> {
    let deleted = false;
    
    if (this.redisCache.isConnected()) {
      deleted = await this.redisCache.delete(key);
    } else {
      deleted = this.memoryCache.delete(key);
    }

    return deleted;
  }

  async clear(): Promise<void> {
    if (this.redisCache.isConnected()) {
      await this.redisCache.clear();
    } else {
      this.memoryCache.clear();
    }
  }

  async has(key: string): Promise<boolean> {
    if (this.redisCache.isConnected()) {
      return await this.redisCache.has(key);
    } else {
      return this.memoryCache.has(key);
    }
  }

  // 缓存装饰器
  async remember<T>(
    key: string, 
    callback: () => Promise<T>, 
    ttlSeconds: number = 3600
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const result = await callback();
    await this.set(key, result, ttlSeconds);
    return result;
  }

  // 生成缓存键
  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  // 批量删除（支持模式匹配）
  async deletePattern(pattern: string): Promise<number> {
    if (this.redisCache.isConnected()) {
      // Redis 支持模式匹配删除
      try {
        const keys = await this.redisCache.client.keys(pattern);
        if (keys.length > 0) {
          return await this.redisCache.client.del(...keys);
        }
        return 0;
      } catch (error) {
        log.error('Redis deletePattern error:', error);
        return 0;
      }
    } else {
      // 内存缓存的简单模式匹配
      let deletedCount = 0;
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      
      for (const key of Array.from((this.memoryCache as any).cache.keys())) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          deletedCount++;
        }
      }
      
      return deletedCount;
    }
  }

  // 获取缓存统计信息
  getStats(): any {
    return {
      type: this.redisCache.isConnected() ? 'redis' : 'memory',
      memorySize: this.memoryCache.size(),
      redisConnected: this.redisCache.isConnected()
    };
  }

  async destroy(): Promise<void> {
    this.memoryCache.destroy();
    await this.redisCache.disconnect();
  }
}

// 创建全局缓存实例
export const cache = new CacheManager();

// 缓存键常量
export const CACHE_KEYS = {
  USER: 'user',
  FILE: 'file',
  FOLDER: 'folder',
  STORAGE_QUOTA: 'storage_quota',
  SUBSCRIPTION: 'subscription',
  PROVIDER: 'provider',
  STATS: 'stats'
} as const;

// 缓存 TTL 常量（秒）
export const CACHE_TTL = {
  SHORT: 5 * 60,      // 5分钟
  MEDIUM: 30 * 60,    // 30分钟
  LONG: 2 * 60 * 60,  // 2小时
  DAY: 24 * 60 * 60   // 24小时
} as const;
