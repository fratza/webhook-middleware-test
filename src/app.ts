import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
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
import process from 'process';

/** Initialize environment and express */
dotenv.config();
const env = process.env.NODE_ENV;
const port = process.env.PORT || 4000;
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
    logger.info(`[INCOMING REQUEST] ${req.method} ${req.url}`);
    res.on('finish', () => {
        logger.info(`[REQUEST SUCCESSFUL] ${req.method} ${req.url} with status ${res.statusCode}`);
    });
    next();
});

/** Log environment variables */
logger.info(`[ENVIRONMENT:PORT] ${env}:${port}`);

/**
 * Route serving checkup controller.
 * @name /api/checkup
 */
app.use('/api/checkup', CHECKUP_ROUTER);

/**
 * Route serving webhook controller.
 * @name /api/webhooks
 */
app.use('/api/webhooks', WEBHOOK_ROUTER);

/**
 * Route serving firestore operations.
 * @name /api/firestore
 */
app.use('/api/firestore', FIRESTORE_ROUTER);

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

/**
 * Start server if in development or serverless mode
 */
if (env === 'dev') {
    app.listen(port, () => {
        logger.info(`[DEVELOPMENT SERVER] Server is running on http://localhost:${port}`);
    });
} else {
    /** Serverless */
    logger.info(`[AWS LAMBDA SERVERLESS] Running on serverless`);
    module.exports.handler = serverless(app);
}
