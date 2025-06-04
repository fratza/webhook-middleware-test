import { Request, Response, NextFunction } from 'express';
import logger from '../../middlewares/logger';

/**
 * Error handling middleware
 *
 * @param {any} err - The error object
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 * @param {NextFunction} next - The Express next middleware function
 */
const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
    logger.error(`Error: ${err}`);
    res.status(400).send({
        error: `Error: ${err}`,
        status: 'error',
    });
};

export default errorHandler;
