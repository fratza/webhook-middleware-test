import { Firestore, WriteBatch } from 'firebase-admin/firestore';
import logger from '../../middlewares/logger';

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
     * @param db - Firestore instance
     */
    constructor(db: Firestore) {
        this.db = db;
    }

    /**
     * Fetches all document IDs from a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection to query.
     * @returns {Promise<string[] | ErrorResponse>} - A promise that resolves to an array of document IDs or an error response.
     */
    async fetchFromCollection(collection: string): Promise<string[] | ErrorResponse> {
        try {
            const snapshot = await this.db.collection(collection).get();
            const documentIds = snapshot.docs.map((doc) => doc.id);
            return documentIds;
        } catch (error) {
            logger.error(`Error fetching documents from Firestore: ${error}`);
            return { error: `Failed to fetch documents: ${error}` };
        }
    }

    /**
     * Fetches a single document by ID from a specified Firestore collection.
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

            return doc.data();
        } catch (error) {
            logger.error(`Error fetching document from Firestore: ${error}`);
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
            logger.error(`Error deleting document from Firestore: ${error}`);
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
            logger.error(`Error fetching categories from Firestore: ${error}`);
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
            logger.error(`Error fetching category data from Firestore: ${error}`);
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

    /**
     * Inserts or updates a document in a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection.
     * @param {string} documentId - The ID of the document to insert or update.
     * @param {any} data - The data to insert or update.
     * @param {boolean} merge - Whether to merge the data with existing data (default: false).
     * @returns {Promise<{success: true; documentId: string} | ErrorResponse>} - A promise that resolves to a success object or an error response.
     */
    /**
     * Creates a batch operation with logging capabilities
     * 
     * @returns {Object} An enhanced batch object with logging methods
     */
    createBatchWithLogging() {
        const batch = this.db.batch();
        let operationCount = 0;
        const startTime = Date.now();
        
        // Enhanced batch with logging
        const enhancedBatch = {
            // Original batch methods
            set: (docRef: FirebaseFirestore.DocumentReference, data: any, options?: FirebaseFirestore.SetOptions) => {
                // Check if this is a new document or an update
                const isNew = !options || (options && !('mergeFields' in options));
                const operation = isNew ? 'SET' : 'UPDATE';
                const path = docRef.path;
                
                logger.info(`[BATCH ${operation}] ${path} - Fields: ${Object.keys(data).length}`);
                
                // For arrays, log their sizes
                Object.entries(data).forEach(([key, value]) => {
                    if (Array.isArray(value)) {
                        logger.info(`[BATCH ${operation}] ${path} - Field '${key}' has ${(value as any[]).length} items`);
                    }
                });
                
                operationCount++;
                // Handle undefined options case
                if (options) {
                    return batch.set(docRef, data, options);
                } else {
                    return batch.set(docRef, data);
                }
            },
            
            update: (docRef: FirebaseFirestore.DocumentReference, data: any) => {
                logger.info(`[BATCH UPDATE] ${docRef.path} - Fields: ${Object.keys(data).length}`);
                operationCount++;
                return batch.update(docRef, data);
            },
            
            delete: (docRef: FirebaseFirestore.DocumentReference) => {
                logger.info(`[BATCH DELETE] ${docRef.path}`);
                operationCount++;
                return batch.delete(docRef);
            },
            
            commit: async () => {
                logger.info(`[BATCH COMMIT] Committing ${operationCount} operations...`);
                try {
                    const result = await batch.commit();
                    const duration = Date.now() - startTime;
                    logger.info(`[BATCH SUCCESS] Committed ${operationCount} operations in ${duration}ms`);
                    return result;
                } catch (error) {
                    logger.error(`[BATCH ERROR] Failed to commit batch: ${error}`);
                    throw error;
                }
            }
        };
        
        return enhancedBatch;
    }

    async insertDocument(
        collection: string,
        documentId: string,
        data: any,
        merge: boolean = false
    ): Promise<{ success: true; documentId: string } | ErrorResponse> {
        try {
            const startTime = Date.now();
            const docRef = this.db.collection(collection).doc(documentId);
            
            // Check if document exists to log appropriate message
            const docSnapshot = await docRef.get();
            const isNewDocument = !docSnapshot.exists;
            
            // Simple logging for database operations
            const operation = isNewDocument ? 'INSERT' : 'UPDATE';
            logger.info(`[DB ${operation}] ${collection}/${documentId} - Data: ${JSON.stringify(data).substring(0, 200)}${JSON.stringify(data).length > 200 ? '...' : ''}`);
            
            // Log the number of fields for quick reference
            const fieldCount = Object.keys(data).length;
            logger.info(`[DB ${operation}] ${collection}/${documentId} - Fields: ${fieldCount}`);
            
            // For arrays, log their sizes
            Object.entries(data).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    logger.info(`[DB ${operation}] ${collection}/${documentId} - Field '${key}' has ${(value as any[]).length} items`);
                }
            });
            
            // Perform the write operation
            await docRef.set(data, { merge });
            
            const duration = Date.now() - startTime;
            logger.info(`[DB Success] ${isNewDocument ? 'Created' : 'Updated'} document '${documentId}' in ${duration}ms`);
            
            return { 
                success: true, 
                documentId 
            };
        } catch (error) {
            logger.error(`Error inserting document into Firestore: ${error}`);
            return { error: `Failed to insert document: ${error}` };
        }
    }
}

export default FirestoreService;
