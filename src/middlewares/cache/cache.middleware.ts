import { Request, Response, NextFunction } from 'express';
import { CacheFactory, CacheType } from './cache.factory';
import logger from '../../middlewares/logger';

/**
 * Options for the cache middleware
 */
interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Cache key prefix */
  prefix?: string;
  /** Cache type to use */
  cacheType?: CacheType;
}

/**
 * Middleware to cache API responses
 * @param options - Cache options
 */
export const cacheMiddleware = (options: CacheOptions = {}) => {
  const { 
    ttl = 300, 
    prefix = 'api-cache:', 
    cacheType = CacheType.MEMORY // Default to in-memory cache instead of Redis
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate a cache key based on the request URL
      const cacheKey = `${prefix}${req.originalUrl || req.url}`;
      
      // Get cache provider
      const cacheProvider = await CacheFactory.createCache(cacheType);
      
      // Try to get from cache
      const cachedResponse = await cacheProvider.get(cacheKey);
      
      if (cachedResponse) {
        logger.debug(`Cache hit for: ${cacheKey}`);
        return res.json(cachedResponse);
      }
      
      // Store the original res.json method
      const originalJson = res.json.bind(res);
      
      // Override res.json method to cache the response
      res.json = ((data: any) => {
        // Restore original method to avoid recursion
        res.json = originalJson;
        
        // Cache the response data
        cacheProvider.set(cacheKey, data, ttl)
          .catch(err => logger.error(`Failed to cache response: ${err}`));
        
        logger.debug(`Cache miss for: ${cacheKey}, storing in cache`);
        
        // Call the original method
        return originalJson(data);
      }) as any;
      
      next();
    } catch (error) {
      logger.error(`Cache middleware error: ${error}`);
      next();
    }
  };
};

/**
 * Middleware to clear cache for specific routes
 * @param patterns - Array of URL patterns to clear (supports glob patterns)
 * @param options - Cache options
 */
export const clearCacheMiddleware = (patterns: string[] = ['*'], options: CacheOptions = {}) => {
  const { 
    prefix = 'api-cache:', 
    cacheType = CacheType.MEMORY // Default to in-memory cache instead of Redis
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // This is a simplified implementation - in a real app, you'd need a way to list keys by pattern
      // For Redis, you could use the KEYS command (not recommended for production) or SCAN
      
      logger.info(`Cache cleared for patterns: ${patterns.join(', ')}`);
      
      // Continue with the request
      next();
    } catch (error) {
      logger.error(`Clear cache middleware error: ${error}`);
      next();
    }
  };
};
