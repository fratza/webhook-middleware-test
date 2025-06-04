import { Firestore } from 'firebase-admin/firestore';
import logger from '../../middlewares/logger';

// Define common return types to avoid repetition
type FirestoreResult<T> = {
    success: boolean;
    error?: string;
    message?: string;
} & T;

/**
 * Service for handling Firestore operations
 */
class FirestoreService {
    private db: Firestore;

    /**
     * Constructor for FirestoreService
     * @param db - Firestore instance
     */
    constructor(db: Firestore) {
        this.db = db;
    }

    /**
     * Fetches all document IDs from a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection to query.
     * @returns {Promise<{ documents: string[] }>} - A promise that resolves to an object containing an array of document IDs.
     */
    async fetchFromCollection(collection: string): Promise<FirestoreResult<{ documents: string[] }>> {
        try {
            const snapshot = await this.db.collection(collection).get();
            const documentIds = snapshot.docs.map((doc) => doc.id);
            return {
                success: true,
                documents: documentIds,
            };
        } catch (error) {
            logger.error(`Error fetching documents from Firestore: ${error}`);
            return { success: false, error: `Failed to fetch documents: ${error}`, documents: [] };
        }
    }

    /**
     * Fetches a single document by ID from a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection.
     * @param {string} documentId - The ID of the document to retrieve.
     * @returns {Promise<FirestoreResult<{ document?: any }>>} - A promise that resolves to the document data.
     */
    async fetchDocumentById(collection: string, documentId: string): Promise<FirestoreResult<{ document?: any }>> {
        try {
            const docRef = this.db.collection(collection).doc(documentId);
            const doc = await docRef.get();

            if (!doc.exists) {
                return { success: false, error: 'Document not found' };
            }

            return { 
                success: true, 
                document: { id: doc.id, ...doc.data() } 
            };
        } catch (error) {
            logger.error(`Error fetching document from Firestore: ${error}`);
            return { success: false, error: `Failed to fetch document: ${error}` };
        }
    }

    /**
     * Deletes a document by ID from a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection.
     * @param {string} documentId - The ID of the document to delete.
     * @returns {Promise<FirestoreResult<{}>>} - A promise that resolves to an object indicating the success of the deletion operation.
     */
    async deleteDocumentById(
        collection: string,
        documentId: string,
    ): Promise<FirestoreResult<{}>> {
        try {
            const docRef = this.db.collection(collection).doc(documentId);

            // Check if document exists before deleting
            const doc = await docRef.get();
            if (!doc.exists) {
                return { success: false, error: 'Document not found' };
            }

            await docRef.delete();
            return { success: true, message: 'Document deleted successfully' };
        } catch (error) {
            logger.error(`Error deleting document from Firestore: ${error}`);
            return { success: false, error: `Failed to delete document: ${error}` };
        }
    }

    /**
     * Fetches array names (categories) from a document in a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection.
     * @param {string} documentId - The ID of the document to fetch categories from.
     * @returns {Promise<FirestoreResult<{ documentId?: string; categories?: string[] }>>} - A promise that resolves to an object containing the document ID and an array of category names.
     */
    async fetchCategoriesFromDocument(
        collection: string,
        documentId: string,
    ): Promise<FirestoreResult<{ documentId?: string; categories?: string[] }>> {
        try {
            const docRef = this.db.collection(collection).doc(documentId);
            const doc = await docRef.get();

            if (!doc.exists) {
                return { success: false, error: 'Document not found' };
            }

            const data = doc.data();
            if (!data) {
                return { success: false, error: 'Document has no data' };
            }

            // Get the data object which contains the arrays
            const docData = data.data || {};

            // Find all keys that are arrays
            const categories = Object.keys(docData).filter(key => Array.isArray(docData[key]));

            return {
                success: true,
                documentId,
                categories,
            };
        } catch (error) {
            logger.error(`Error fetching categories from Firestore: ${error}`);
            return { success: false, error: `Failed to fetch categories: ${error}` };
        }
    }

    /**
     * Fetches data from a specific category in a document from a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection.
     * @param {string} documentId - The ID of the document to fetch data from.
     * @param {string} categoryName - The name of the category (array) to fetch data from.
     * @returns {Promise<FirestoreResult<{ documentId?: string; categoryName?: string; data?: object[]; count?: number }>>} - A promise that resolves to an object containing the document ID, category name, and an array of category data.
     */
    async fetchCategoryData(
        collection: string,
        documentId: string,
        categoryName: string,
    ): Promise<FirestoreResult<{
        documentId?: string;
        categoryName?: string;
        data?: object[];
        count?: number;
    }>> {
        try {
            const docRef = this.db.collection(collection).doc(documentId);
            const doc = await docRef.get();

            if (!doc.exists) {
                return { success: false, error: 'Document not found' };
            }

            const data = doc.data();
            if (!data) {
                return { success: false, error: 'Document has no data' };
            }

            const docData = data.data || {};

            // Check if the category exists and is an array
            if (!docData[categoryName] || !Array.isArray(docData[categoryName])) {
                return {
                    success: false,
                    error: `Category '${categoryName}' not found or is not an array`,
                };
            }

            // Sort the data in descending order by publishedDate or createdAt
            const sortedData = this.sortCategoryData(docData[categoryName]);

            return {
                success: true,
                documentId,
                categoryName,
                data: sortedData,
                count: sortedData.length
            };
        } catch (error) {
            logger.error(`Error fetching category data from Firestore: ${error}`);
            return { success: false, error: `Failed to fetch category data: ${error}` };
        }
    }

    /**
     * Sorts category data by date fields in descending order (newest first)
     * @param items Array of items to sort
     * @returns Sorted array
     */
    private sortCategoryData(items: any[]): any[] {
        return [...items].sort((a, b) => {
            // Try to use publishedDate first, then fall back to createdAt
            const dateA = a.publishedDate || a.createdAt || a.createdAtFormatted || 0;
            const dateB = b.publishedDate || b.createdAt || b.createdAtFormatted || 0;

            // If the dates are Firestore timestamps, convert them to milliseconds
            const timeA = dateA && typeof dateA.toMillis === 'function' ? dateA.toMillis() : dateA;
            const timeB = dateB && typeof dateB.toMillis === 'function' ? dateB.toMillis() : dateB;

            // Sort in descending order (newest first)
            return timeB - timeA;
        });
    }
}

export default FirestoreService;
