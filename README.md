# Webhook Middleware

A Node.js middleware that generates webhooks and handles API requests.

## Features

-   Register webhooks with custom URLs and events
-   Generate secure webhook secrets
-   Sign webhook payloads with HMAC
-   List registered webhooks
-   Delete webhooks
-   Trigger webhook events
-   Redis caching for improved performance

## API Endpoints

### Register a Webhook

```http
POST /api/webhooks/register
Content-Type: application/json

{
    "url": "https://your-endpoint.com/webhook",
    "events": ["event1", "event2"]
}
```

### List Webhooks

```http
GET /api/webhooks
```

### Delete a Webhook

```http
DELETE /api/webhooks/:webhookId
```

### Trigger an Event

```http
POST /api/trigger
Content-Type: application/json

{
    "event": "event1",
    "data": {
        "key": "value"
    }
}
```

## Installation

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

The server will run on port 3000 by default. Set PORT environment variable to change it.

## Redis Caching

This application uses Redis for caching API responses and improving performance. The implementation includes:

- Configurable cache TTL (Time To Live)
- Fallback to in-memory cache if Redis is not available
- Cache middleware for easy integration with Express routes
- Cache invalidation utilities

### Configuration

To configure Redis, set the following environment variables:

```
REDIS_URL=redis://localhost:6379
REDIS_USERNAME=your_username  # Optional
REDIS_PASSWORD=your_password  # Optional
REDIS_DEFAULT_TTL=300         # Cache TTL in seconds (default: 300)
REDIS_ENABLED=true            # Set to false to use in-memory cache instead
```

### Using Cache Middleware

The cache middleware can be used to cache API responses:

```typescript
import { cacheMiddleware } from './middlewares/cache/cache.middleware';
import { CacheType } from './middlewares/cache/cache.factory';

// Apply cache middleware to a route
router.get('/data', 
  cacheMiddleware({ 
    ttl: 300,                // TTL in seconds
    prefix: 'api-cache:',    // Cache key prefix
    cacheType: CacheType.REDIS  // REDIS or MEMORY
  }), 
  (req, res) => {
    // Your route handler
    res.json({ data: 'example' });
  }
);
```

### Example Route

An example route with Redis caching is available at `/api/example/data`. This demonstrates how the cache works - the first request will be slow, but subsequent requests will be served from the cache until the TTL expires.
