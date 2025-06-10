import { db } from '../../config/firebase';
import { Firestore } from 'firebase-admin/firestore';

// Define error response type
type ErrorResponse = {
    error: string;
};

/**
 * Service for handling Firestore operations
 */
class FirestoreService {
    private db: Firestore;

    /**
     * Constructor for FirestoreService
     */
    constructor() {
        this.db = db;
    }

    /**
     * Fetches all document IDs from a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection to query.
     * @returns {Promise<string[] | ErrorResponse>} - A promise that resolves to an array of document IDs or an error response
     */
    async fetchFromCollection(collection: string): Promise<string[] | ErrorResponse> {
        try {
            const snapshot = await this.db.collection(collection).get();
            const documentIds = snapshot.docs.map((doc) => doc.id);
            return documentIds;
        } catch (error) {
            console.error(`Error fetching documents from Firestore: ${error}`);
            return { error: `Failed to fetch documents: ${error}` };
        }
    }

    /**
     * Fetches a single document by ID from a specified Firestore collection.
     * Unwraps the data structure to return the array directly without 'data' and category wrappers.
     *
     * @param {string} collection - The name of the Firestore collection.
     * @param {string} documentId - The ID of the document to retrieve.
     * @returns {Promise<any | ErrorResponse>} - A promise that resolves to the document data or an error response.
     */
    async fetchDocumentById(collection: string, documentId: string): Promise<any | ErrorResponse> {
        try {
            const docRef = this.db.collection(collection).doc(documentId);
            const doc = await docRef.get();

            if (!doc.exists) {
                return { error: 'Document not found' };
            }

            const docData = doc.data();

            // Check if data has the nested structure we want to unwrap
            if (docData && docData.data) {
                // Find the first array in the data object (e.g., OleSports)
                const dataKeys = Object.keys(docData.data);
                for (const key of dataKeys) {
                    if (Array.isArray(docData.data[key])) {
                        return docData.data[key]; // Return the array directly
                    }
                }

                // If no arrays found, return the data object without the wrapper
                return docData.data;
            }

            // Return the original data if it doesn't have the expected structure
            return docData;
        } catch (error) {
            console.error(`Error fetching document from Firestore: ${error}`);
            return { error: `Failed to fetch document: ${error}` };
        }
    }

    /**
     * Deletes a document by ID from a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection.
     * @param {string} documentId - The ID of the document to delete.
     * @returns {Promise<{success: true; message: string} | ErrorResponse>} - A promise that resolves to a success object or an error response.
     */
    async deleteDocumentById(
        collection: string,
        documentId: string,
    ): Promise<{ success: true; message: string } | ErrorResponse> {
        try {
            const docRef = this.db.collection(collection).doc(documentId);

            // Check if document exists before deleting
            const doc = await docRef.get();
            if (!doc.exists) {
                return { error: 'Document not found' };
            }

            await docRef.delete();
            return { success: true, message: 'Document deleted successfully' };
        } catch (error) {
            console.error(`Error deleting document from Firestore: ${error}`);
            return { error: `Failed to delete document: ${error}` };
        }
    }

    /**
     * Fetches array names (categories) from a document in a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection.
     * @param {string} documentId - The ID of the document to fetch categories from.
     * @returns {Promise<{ documentId: string; categories: string[] }>} - A promise that resolves to an object containing the document ID and an array of category names.
     * @throws {Error} - Throws an error if document not found or has no data
     */
    async fetchCategoriesFromDocument(
        collection: string,
        documentId: string,
    ): Promise<{ documentId: string; categories: string[] }> {
        try {
            const docRef = this.db.collection(collection).doc(documentId);
            const doc = await docRef.get();

            if (!doc.exists) {
                throw new Error('Document not found');
            }

            const data = doc.data();
            if (!data) {
                throw new Error('Document has no data');
            }

            // Get the data object which contains the arrays
            const docData = data.data || {};

            // Find all keys that are arrays
            const categories = Object.keys(docData).filter((key) => Array.isArray(docData[key]));

            return {
                documentId,
                categories,
            };
        } catch (error) {
            console.error(`Error fetching categories from Firestore: ${error}`);
            throw error;
        }
    }

    /**
     * Fetches data from a specific category in a document from a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection.
     * @param {string} documentId - The ID of the document to fetch data from.
     * @param {string} categoryName - The name of the category (array) to fetch data from.
     * @returns {Promise<object[]>} - A promise that resolves to an array of category data.
     * @throws {Error} - Throws an error if document not found or category doesn't exist
     */
    async fetchCategoryData(collection: string, documentId: string, categoryName: string): Promise<object[]> {
        try {
            const docRef = this.db.collection(collection).doc(documentId);
            const doc = await docRef.get();

            if (!doc.exists) {
                throw new Error('Document not found');
            }

            const data = doc.data();
            if (!data) {
                throw new Error('Document has no data');
            }

            const docData = data.data || {};

            // Check if the category exists and is an array
            if (!docData[categoryName] || !Array.isArray(docData[categoryName])) {
                throw new Error(`Category '${categoryName}' not found or is not an array`);
            }

            // Sort the data in descending order by publishedDate or createdAt
            return this.sortCategoryData(docData[categoryName]);
        } catch (error) {
            console.error(`Error fetching category data from Firestore: ${error}`);
            throw error;
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
