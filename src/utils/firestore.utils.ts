import { admin } from '../config/firebase';
import logger from '../middlewares/logger';
import FirestoreService from '../services/firestore';

interface DateFilterableItem {
    Date?: string;
    EventDate?: string;
    [key: string]: any;
}

/**
 * Helper function to convert data to Firestore format
 *
 * @param {any} data - Data to convert
 * @returns {any} Returns converted data
 */
export function convertToFirestoreFormat(data: any): any {
    if (data === null || data === undefined) return null;

    if (data instanceof Date) return admin.firestore.Timestamp.fromDate(data);

    if (Array.isArray(data)) return data.map((item) => convertToFirestoreFormat(item));

    if (typeof data === 'object') {
        const result: { [key: string]: any } = {};
        for (const [key, value] of Object.entries(data)) {
            // Convert dates in ISO format to Firestore Timestamp
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
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

/**
 * Helper function to find a category by name (case-insensitive)
 * @param collection Collection name
 * @param documentName Document name
 * @param subcategory Category to find
 * @param firestoreInstance Optional Firestore instance to use
 * @returns The matched category name with correct case
 */
export async function findMatchedCategory(
    collection: string,
    documentName: string,
    subcategory: string,
    firestoreInstance?: any,
): Promise<string> {
    // Create a new FirestoreService or use the provided instance's service
    const firestoreService = firestoreInstance ? new FirestoreService() : new FirestoreService();
    const result = await firestoreService.fetchCategoriesFromDocument(collection, documentName);

    // Find the actual category name with correct case
    const subcategoryLower = subcategory.toLowerCase();
    const foundCategory = result.categories?.find((category) => category.toLowerCase() === subcategoryLower);

    if (!foundCategory) {
        throw {
            status: 404,
            message: `Category '${subcategory}' not found`,
            availableCategories: result.categories,
        };
    }

    return foundCategory;
}

/**
 * Filter items by date range or from a specific date onward
 * @param items Array of items to filter
 * @param fromDate Optional start date for filtering
 * @param toDate Optional end date for filtering
 * @returns Filtered array of items
 */
export function filterItemsByDate<T extends DateFilterableItem>(items: T[], fromDate?: Date, toDate?: Date): T[] {
    if (!fromDate) return items;

    // Case 1: Both fromDate and toDate are provided
    if (fromDate && toDate) {
        return items.filter((item) => {
            // Use the Date field from the database (YYYY-MM-DD format)
            if (item.Date) {
                const itemDate = new Date(item.Date);
                if (!isNaN(itemDate.getTime())) {
                    // Check if the date is within the range
                    return itemDate >= fromDate && itemDate <= toDate;
                }
            }

            // If Date is not valid or doesn't exist, exclude this item
            return false;
        });
    }

    // Case 2: Only fromDate is provided (filter from that date onward)
    return items.filter((item) => {
        // Use the Date field from the database (YYYY-MM-DD format)
        if (item.Date) {
            const itemDate = new Date(item.Date);
            if (!isNaN(itemDate.getTime())) {
                // Check if the date is after fromDate
                return itemDate >= fromDate;
            }
        }

        // If Date is not valid or doesn't exist, exclude this item
        return false;
    });
}
