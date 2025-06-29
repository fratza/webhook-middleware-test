// Load environment variables from .env file first, before other imports
import dotenv from 'dotenv';
// Configure dotenv at the very beginning
dotenv.config({ path: './.env' });

// Other imports
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import serverless from 'serverless-http';

/** Middlewares */
import logger from './middlewares/logger';
import errorHandler from './middlewares/error/error.middleware';

/** Controllers */
import CHECKUP_ROUTER from './routes/checkup';
import WEBHOOK_ROUTER from './routes/webhook';
import FIRESTORE_ROUTER from './routes/firestore';
import EXAMPLE_ROUTER from './routes/example/cached-route';
import process from 'process';

/** Initialize environment and express */
// dotenv already configured above
const env = process.env.NODE_ENV;
const port = process.env.PORT || 3000;
const app: Application = express();

/** Use helmet to secure Express apps by setting various HTTP headers */
app.use(helmet());

/** Enable CORS with default options */
app.use(cors());

/** Express body parser */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/** Middleware to log requests
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 */
app.use('/', (req: Request, res: Response, next: NextFunction) => {
    const isImportantEndpoint = req.url.includes('/api/webhook') || req.url.includes('/api/firestore');

    if (req.method !== 'GET' || isImportantEndpoint) {
        logger.debug(`[REQUEST] ${req.method} ${req.url}`);
    }

    res.on('finish', () => {
        // Only log errors or important endpoints with status codes
        if (res.statusCode >= 400 || isImportantEndpoint) {
            const logLevel = res.statusCode >= 400 ? 'error' : 'info';
            logger[logLevel](`[RESPONSE] ${req.method} ${req.url} with status ${res.statusCode}`);
        }
    });
    next();
});

/** Log environment variables */
console.log(`[ENVIRONMENT:PORT] ${env}:${port}`);

/**
 * Route serving checkup controller.
 * @name /api/checkup
 */
app.use('/api/checkup', CHECKUP_ROUTER);

/**
 * Route serving webhook controller.
 * @name /api/webhooks
 */
app.use('/api/webhook', WEBHOOK_ROUTER);

/**
 * Route serving firestore operations.
 * @name /api/firestore
 */
app.use('/api/firestore', FIRESTORE_ROUTER);

/**
 * Route serving example with Redis caching.
 * @name /api/example
 */
app.use('/api/example', EXAMPLE_ROUTER);

/**
 * Error handling middleware
 */
app.use(errorHandler);

/**
 * Global error handlers for unhandled exceptions and rejections
 */
process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
    logger.error(`[ERROR - Unhandled Rejection]: ${reason}`);
});
process.on('uncaughtException', (error: Error) => {
    logger.error(`[ERROR - Uncaught Exception]: ${error.message}`);
});

app.listen(port, () => {
    console.log(`Webhook middleware running on port ${port}`);
});

// AWS SETUP
if (env === 'local') {
    app.listen(port, () => {
        console.log(`[LOCAL SERVER] Server is running on http://localhost:${port}`);
    });
} else {
    /** Serverless */
    console.log(`[AWS LAMBDA SERVERLESS] Running on serverless`);
    module.exports.handler = serverless(app);
}
