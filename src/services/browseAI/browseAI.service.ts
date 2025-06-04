import { admin, db } from '../../config/firebase';
import logger from '../../middlewares/logger';
import { convertToFirestoreFormat } from '../../utils/firestore';
import { BrowseAIWebhookData } from '../../interfaces';
import {
    appendNewData,
    extractDomainIdentifier,
    cleanDataFields,
    processArrayField,
    processArrayItem,
    processEventDate,
    parseEventDate,
    logFilteringResults,
    deduplicateItems,
    deduplicateAgainstExisting,
    createUniqueKeyForItem,
} from '../../utils/browseai';

export class BrowseAIService {
    /**
     * Handles and stores data from a BrowseAI webhook.
     *
     * @param {BrowseAIWebhookData} webhookData - Data received from the webhook.
     * @returns {Promise<Object>} Result of the processing.
     */
    public async processWebhookData(webhookData: BrowseAIWebhookData): Promise<Object> {
        logger.info('[BrowseAI] Starting to process incoming request...');
        const task = webhookData?.task;
        const inputParams = task.inputParameters || {};
        const [firstKey, firstValue] = Object.entries(inputParams)[0] || [];

        const originUrl = (firstValue as string) || 'unknown';
        const docName = extractDomainIdentifier(originUrl);

        const timestamp = admin.firestore.Timestamp.fromDate(new Date());

        const batch = db.batch();

        logger.info('[BrowseAI] Processing captured data...');

        if (task.capturedTexts) {
            await this.storeCapturedTexts(batch, docName, originUrl, task.capturedTexts);
        }

        if (task.capturedScreenshots) {
            await this.storeCapturedScreenshots(batch, docName, originUrl, task.capturedScreenshots);
        }

        if (task.capturedLists) {
            await this.storeCapturedLists(batch, docName, originUrl, task.capturedLists);
        }

        // We can't access internal properties of the batch, so just log the commit
        logger.info('[Firestore] Committing batch write...');
        const startTime = Date.now();
        await batch.commit();
        const duration = Date.now() - startTime;
        logger.info(`[Firestore] Batch write successful! Completed in ${duration}ms`);

        return {
            success: true,
            meta: {
                processedAt: timestamp.toDate().toISOString(),
                collections: ['captured_texts', 'captured_screenshots', 'captured_lists'],
            },
        };
    }

    /**
     * Stores captured texts in Firestore using the provided batch.
     *
     * @param {WriteBatch} batch - Firestore batch instance.
     * @param {string} originUrl - Source URL of the captured data.
     * @param {any} texts - Captured text data.
     * @param {Timestamp} timestamp - Firestore timestamp for record creation.
     */
    private async storeCapturedTexts(
        batch: FirebaseFirestore.WriteBatch,
        docName: string,
        originUrl: string,
        texts: any,
    ): Promise<void> {
        logger.info('[Texts] Processing captured texts...');
        const textsRef = db.collection('captured_texts').doc(docName);
        const textsData = convertToFirestoreFormat(texts);

        const docSnapshot = await textsRef.get();
        const existingData = docSnapshot.exists ? docSnapshot.data() : null;

        // Pass existing data and originUrl to cleanDataFields
        const processedData = cleanDataFields(textsData, existingData, originUrl, docName);

        if (docSnapshot.exists) {
            logger.info(`[Texts] Document '${docName}' exists, updating with new data from ${originUrl}`);
            const appendData = appendNewData(docSnapshot, processedData, originUrl);
            batch.set(textsRef, appendData);
            logger.info(`[Texts] Updated document '${docName}' with merged data`);
        } else {
            // Document doesn't exist, create new document
            logger.info(`[Texts] Creating new document '${docName}' with data from ${originUrl}`);
            const prepData = {
                data: {
                    ...processedData,
                },
            };
            batch.set(textsRef, prepData);
            logger.info(`[Texts] Created new document '${docName}' with ${Object.keys(processedData).length} fields`);
        }
    }

    /**
     * Stores captured screenshots in Firestore using the provided batch.
     *
     * @param {WriteBatch} batch - Firestore batch instance.
     * @param {string} docName - Document name derived from domain.
     * @param {string} originUrl - Source URL of the captured data.
     * @param {any} screenshots - Captured screenshot data.
     */
    private async storeCapturedScreenshots(
        batch: FirebaseFirestore.WriteBatch,
        docName: string,
        originUrl: string,
        screenshots: any,
    ): Promise<void> {
        logger.info('[Screenshots] Processing captured screenshots...');
        const screenshotsRef = db.collection('captured_screenshots').doc(docName);
        const screenshotsData = convertToFirestoreFormat(screenshots);

        const docSnapshot = await screenshotsRef.get();
        const existingData = docSnapshot.exists ? docSnapshot.data() : null;

        // Pass existing data and originUrl to cleanDataFields
        const processedData = cleanDataFields(screenshotsData, existingData, originUrl, docName);

        if (docSnapshot.exists) {
            logger.info(`[Screenshots] Document '${docName}' already exists, updating data...`);

            // Merge with existing data
            const appendData = appendNewData(docSnapshot, processedData, originUrl);
            batch.set(screenshotsRef, appendData);
            logger.info(`[Screenshots] Updated document '${docName}' with merged data`);
        } else {
            // Document doesn't exist, create new document
            logger.info(`[Screenshots] Creating new document '${docName}' with data from ${originUrl}`);
            const prepData = {
                data: {
                    ...processedData,
                },
            };
            batch.set(screenshotsRef, prepData);
            logger.info(
                `[Screenshots] Created new document '${docName}' with ${Object.keys(processedData).length} fields`,
            );
        }

        logger.info(`[Screenshots] Prepared for storage with ID: ${docName}`);
    }

    /**
     * Stores captured lists in Firestore
     * @param batch The batch to add the write operation to
     * @param docName Document name derived from domain
     * @param originUrl The origin URL of the data
     * @param lists The captured lists to store
     */
    private async storeCapturedLists(
        batch: FirebaseFirestore.WriteBatch,
        docName: string,
        originUrl: string,
        lists: any,
    ): Promise<void> {
        logger.info('[Lists] Processing captured lists...');

        const listsRef = db.collection('captured_lists').doc(docName);
        const listsData = convertToFirestoreFormat(lists);

        // Check if document already exists
        const docSnapshot = await listsRef.get();
        const existingData = docSnapshot.exists ? docSnapshot.data() : null;

        // Clean and process the data
        const processedData = cleanDataFields(listsData, existingData, originUrl, docName);

        if (docSnapshot.exists) {
            logger.info(`[Lists] Document '${docName}' already exists, updating data...`);

            // Merge with existing data
            const appendData = appendNewData(docSnapshot, processedData, originUrl);
            batch.set(listsRef, appendData);

            // Log the fields being updated
            const fieldCount = Object.keys(processedData).length;
            logger.info(`[Lists] Updated document '${docName}' with ${fieldCount} fields`);

            // Log details about arrays being updated
            Object.entries(processedData).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    logger.info(`[Lists] Field '${key}' contains ${value.length} items`);
                }
            });
        } else {
            // Document doesn't exist, create new document
            const prepData = {
                data: {
                    ...processedData,
                },
            };
            batch.set(listsRef, prepData);

            // Log the fields being created
            const fieldCount = Object.keys(processedData).length;
            logger.info(`[Lists] Created new document '${docName}' with ${fieldCount} fields`);

            // Log details about arrays being created
            Object.entries(processedData).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    logger.info(`[Lists] New field '${key}' contains ${value.length} items`);
                }
            });
        }

        logger.info(`[Lists] Prepared for storage with ID: ${docName}`);
    }

    public static async fetchFromCollection(collection: string): Promise<string[]> {
        logger.info(`[BrowseAI] Fetching from collection ${collection}...`);
        try {
            const collectionRef = db.collection(collection);
            const snapshot = await collectionRef.get();
            const documentIds = snapshot.docs.map((doc) => doc.id);
            return documentIds;
        } catch (error) {
            logger.error(`Error fetching from collection ${collection}:`, error);
            throw error;
        }
    }

    /**
     * Fetches a document by ID from a specified Firestore collection.
     *
     * @param {string} collection - Name of the Firestore collection.
     * @param {string} documentId - ID of the document to retrieve.
     * @returns {Promise<{ id: string; data: any }>} - The document ID and its data.
     * @throws {Error} - If the document does not exist or the fetch fails.
     */
    public static async fetchDocumentById(collection: string, documentId: string): Promise<{ id: string; data: any }> {
        logger.info(`[BrowseAI] Fetching document ${documentId} from collection ${collection}...`);
        try {
            const docRef = db.collection(collection).doc(documentId);
            const docSnapshot = await docRef.get();

            if (!docSnapshot.exists) {
                throw new Error(`Document not found in collection '${collection}' with ID '${documentId}'`);
            }

            return {
                id: docSnapshot.id,
                data: docSnapshot.data(),
            };
        } catch (error) {
            logger.error(`Error fetching document ${documentId} from collection ${collection}:`, error);
            throw error;
        }
    }

    /**
     * Deletes a document by ID from a specified Firestore collection.
     *
     * @param {string} collection - Name of the Firestore collection.
     * @param {string} documentId - ID of the document to delete.
     * @returns {Promise<{ success: boolean; deletedAt: string }>} - Success status and deletion timestamp.
     * @throws {Error} - If the document doesn't exist or deletion fails.
     */
    public static async deleteDocumentById(
        collection: string,
        documentId: string,
    ): Promise<{ success: boolean; deletedAt: string }> {
        logger.info(`[BrowseAI] Deleting document ${documentId} from collection ${collection}...`);
        try {
            const docRef = db.collection(collection).doc(documentId);
            const docSnapshot = await docRef.get();

            if (!docSnapshot.exists) {
                throw new Error(`Document not found in collection '${collection}' with ID '${documentId}'`);
            }

            await docRef.delete();
            const deletedAt = new Date().toISOString();
            logger.info(
                `[BrowseAI] Successfully deleted document ${documentId} from collection ${collection} at ${deletedAt}`,
            );

            return {
                success: true,
                deletedAt,
            };
        } catch (error) {
            logger.error(`Error deleting document ${documentId} from collection ${collection}:`, error);
            throw error;
        }
    }
}
