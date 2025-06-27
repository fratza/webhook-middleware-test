import { Router } from 'express';
import { cacheMiddleware, clearCacheMiddleware } from '../../middlewares/cache/cache.middleware';
import { CacheType } from '../../middlewares/cache/cache.factory';
import { ENV } from '../../environments/environment.dev';
import logger from '../../middlewares/logger';

const router = Router();

// Always use in-memory cache for now until Redis is properly configured in Lambda
const cacheType = CacheType.MEMORY;

// Log which cache type is being used
logger.info(`Example route using cache type: ${cacheType}`);

/**
 * Example route with caching
 * GET /api/example/data
 */
router.get(
    '/data',
    cacheMiddleware({
        ttl: ENV.redis?.defaultTtl || 300,
        prefix: 'example-api:',
        cacheType,
    }),
    async (req, res) => {
        try {
            // Simulate a delay to demonstrate caching benefit
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Example data that would normally come from a database or external API
            const data = {
                id: 1,
                name: 'Example Data',
                timestamp: new Date().toISOString(),
                cached: false,
                cacheType: cacheType,
            };

            logger.info('Fetched example data');
            res.json(data);
        } catch (error) {
            logger.error(`Error fetching data: ${error}`);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
);

/**
 * Clear cache for the example routes
 * POST /api/example/clear-cache
 */
router.post('/clear-cache', clearCacheMiddleware(['example-api:*'], { cacheType }), (req, res) => {
    res.json({
        message: 'Cache cleared successfully',
        cacheType: cacheType,
    });
});

export default router;
