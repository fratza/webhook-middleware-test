import winston from 'winston';
import 'winston-daily-rotate-file';

const logDir = 'logs';

/**
 * Creates a Winston logger instance with console and optional daily rotate file transports.
 * The logger logs messages to both the console and daily rotated files.
 * The log files are stored in the 'logs' directory, and each file is named with the date.
 * The log files are zipped after reaching a maximum size of 20MB and are retained for 14 days.
 *
 * @constant
 * @type {winston.Logger}
 */
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`),
    ),
    transports: [
        new winston.transports.Console(), // Log to console always
    ],
});

// Add file transport only if not running in AWS Lambda
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    logger.add(
        new winston.transports.DailyRotateFile({
            dirname: logDir,
            filename: '%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
        }),
    );
}

export default logger;
