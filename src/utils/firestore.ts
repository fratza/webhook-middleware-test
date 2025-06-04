import { admin } from '../config/firebase';
import logger from '../middlewares/logger';

/**
 * Helper function to convert data to Firestore format
 *
 * @param {any} data - Data to convert
 * @returns {any} Returns converted data
 */
export function convertToFirestoreFormat(data: any): any {
  logger.info('[Convert] Starting data conversion...');

  if (data === null || data === undefined) {
    logger.info('[Convert] Null or undefined data detected');
    return null;
  }

  if (data instanceof Date) {
    logger.info('[Convert] Converting Date to Timestamp');
    return admin.firestore.Timestamp.fromDate(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => convertToFirestoreFormat(item));
  }

  if (typeof data === 'object') {
    const result: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(data)) {
      // Convert dates in ISO format to Firestore Timestamp
      if (
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
      ) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          result[key] = admin.firestore.Timestamp.fromDate(date);
          continue;
        }
      }
      result[key] = convertToFirestoreFormat(value);
    }
    return result;
  }

  return data;
}
