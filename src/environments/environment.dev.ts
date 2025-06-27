import * as dotenv from 'dotenv';
dotenv.config();

export const ENV = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    webhook: process.env.WEBHOOK || '',

    // Firebase configuration
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || '',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
        databaseId: process.env.FIREBASE_DATABASE_ID || 'default',
    },
    
    // Redis configuration
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        username: process.env.REDIS_USERNAME || '',
        password: process.env.REDIS_PASSWORD || '',
        // Default TTL for cache entries in seconds (5 minutes)
        defaultTtl: parseInt(process.env.REDIS_DEFAULT_TTL || '300', 10),
        // Whether to use Redis for caching (falls back to in-memory if false)
        enabled: process.env.REDIS_ENABLED === 'true',
    },
};
