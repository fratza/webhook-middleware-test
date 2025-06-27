import { CacheProvider } from './index';
import logger from '../../middlewares/logger';

/**
 * Mock Redis implementation of the cache provider
 * This implementation doesn't use the Redis package
 */
export class RedisCache implements CacheProvider {
    /**
     * Creates a new Redis cache provider
     * @param redisClient - The Redis client instance (not used in this mock implementation)
     */
    constructor(private redisClient: any) {
        logger.info('Mock Redis cache provider initialized');
    }

    /**
     * Retrieves a value from the cache by key
     * @param key - The cache key
     * @returns Always returns null in this mock implementation
     */
    async get(key: string): Promise<any | null> {
        logger.debug(`Redis functionality disabled: get operation skipped for key ${key}`);
        return null;
    }

    /**
     * Sets a value in the cache
     * @param key - The cache key
     * @param value - The value to cache
     * @param ttlSeconds - Time to live in seconds (default: 300)
     */
    async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
        logger.debug(`Redis functionality disabled: set operation skipped for key ${key}`);
    }

    /**
     * Deletes a value from the cache
     * @param key - The cache key to delete
     */
    async delete(key: string): Promise<void> {
        logger.debug(`Redis functionality disabled: delete operation skipped for key ${key}`);
    }
}
