import logger from '../middlewares/logger';

/**
 * Mock Redis client implementation
 * This file replaces the actual Redis implementation to avoid dependencies on the redis package
 */

// Mock Redis client that does nothing
const createMockClient = () => {
  return {
    // Add mock methods as needed
    get: async () => null,
    set: async () => {},
    del: async () => {},
    connect: async () => {},
    on: (event: string, callback: Function) => {}
  };
};

// Create a singleton instance
let redisClient: any = null;

// Create Redis client - MOCK IMPLEMENTATION
export const createRedisClient = async () => {
  logger.info('Redis functionality disabled: Using mock Redis client');
  return createMockClient();
};

export const getRedisClient = async () => {
  if (!redisClient) {
    redisClient = await createRedisClient();
  }
  return redisClient;
};
