import { CacheProvider, InMemoryCache } from './index';
import { RedisCache } from './redis.provider';
import logger from '../../middlewares/logger';

/**
 * Cache type options
 */
export enum CacheType {
  MEMORY = 'memory',
  REDIS = 'redis' // Kept for backward compatibility
}

/**
 * Factory class for creating cache providers
 */
export class CacheFactory {
  /**
   * Creates a cache provider based on the specified type
   * @param type - The type of cache to create
   * @returns A promise that resolves to a cache provider
   */
  static async createCache(type: CacheType = CacheType.MEMORY): Promise<CacheProvider> {
    // Always use in-memory cache regardless of the requested type
    if (type === CacheType.REDIS) {
      logger.info('Redis cache requested but Redis functionality is disabled. Using in-memory cache instead.');
    } else {
      logger.info('Using in-memory cache provider');
    }
    return new InMemoryCache();
    
    // Original implementation:
    // switch (type) {
    //   case CacheType.REDIS:
    //     try {
    //       const redisClient = await getRedisClient();
    //       logger.info('Using Redis cache provider');
    //       return new RedisCache(redisClient);
    //     } catch (error) {
    //       logger.error(`Failed to create Redis cache, falling back to in-memory cache: ${error}`);
    //       return new InMemoryCache();
    //     }
    //   case CacheType.MEMORY:
    //   default:
    //     logger.info('Using in-memory cache provider');
    //     return new InMemoryCache();
    // }
  }
}
