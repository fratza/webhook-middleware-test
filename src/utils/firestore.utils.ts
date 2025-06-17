import { admin } from '../config/firebase';
import logger from '../middlewares/logger';
import FirestoreService from '../services/firestore';

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
 * @returns The matched category name with correct case
 */
export async function findMatchedCategory(collection: string, documentName: string, subcategory: string): Promise<string> {
    const firestoreService = new FirestoreService();
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
