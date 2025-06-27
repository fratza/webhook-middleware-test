/**
 * Cache interface that can be implemented with different backends
 */
export interface CacheProvider {
    get(key: string): Promise<any | null>;
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    delete(key: string): Promise<void>;
}

/**
 * In-memory implementation of the cache provider
 */
export class InMemoryCache implements CacheProvider {
    private cache: Map<string, { value: any; expiry: number }> = new Map();

    async get(key: string): Promise<any | null> {
        const item = this.cache.get(key);
        const now = Date.now();

        if (!item) {
            return null;
        }

        // Return null if expired
        if (item.expiry < now) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
        const expiry = Date.now() + ttlSeconds * 1000;
        this.cache.set(key, { value, expiry });
    }

    async delete(key: string): Promise<void> {
        this.cache.delete(key);
    }
}

/**
 * Redis implementation of the cache provider
 * This is a placeholder for future implementation when Redis is added to the project
 */
export class RedisCache implements CacheProvider {
    // This would be initialized with a Redis client
    constructor(private redisClient: any) {}

    async get(key: string): Promise<any | null> {
        try {
            const value = await this.redisClient.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error(`Error getting value from Redis: ${error}`);
            return null;
        }
    }

    async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
        try {
            const stringValue = JSON.stringify(value);
            await this.redisClient.set(key, stringValue, { EX: ttlSeconds });
        } catch (error) {
            console.error(`Error setting value in Redis: ${error}`);
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.redisClient.del(key);
        } catch (error) {
            console.error(`Error deleting key from Redis: ${error}`);
        }
    }
}
