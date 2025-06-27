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

    /**
     * Retrieves a value from the cache by key
     * @param key - The cache key
     * @returns The cached value or null if not found
     */
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

    /**
     * Sets a value in the cache
     * @param key - The cache key
     * @param value - The value to cache
     * @param ttlSeconds - Time to live in seconds (default: 300)
     */
    async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
        const expiry = Date.now() + ttlSeconds * 1000;
        this.cache.set(key, { value, expiry });
    }

    /**
     * Deletes a value from the cache
     * @param key - The cache key to delete
     */
    async delete(key: string): Promise<void> {
        this.cache.delete(key);
    }
}

// Create a default instance of the in-memory cache
const cacheProvider: CacheProvider = new InMemoryCache();

export { cacheProvider };
