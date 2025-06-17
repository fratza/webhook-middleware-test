import { admin, db } from '../../config/firebase';
import { Firestore } from 'firebase-admin/firestore';
import { convertToFirestoreFormat } from '../../utils/firestore.utils';
import { BrowseAIWebhookData } from '../../interfaces';
import { appendNewData, extractDomainIdentifier, cleanDataFields } from '../../utils/browseai.utils';
import { processSportsItem, processOleMissItem } from '../../utils/olemiss';
import logger from '../../middlewares/logger';

export class BrowseAIService {
    /**
     * Handles and stores data from a BrowseAI webhook.
     *
     * @param {BrowseAIWebhookData} webhookData - Data received from the webhook.
     * @returns {Promise<Object>} Result of the processing.
     */

    private db: Firestore;
    public task: any; // Using any instead of object to avoid property access issues

    constructor() {
        this.db = db;
    }

    public async processWebhookData(webhookData: BrowseAIWebhookData): Promise<Object> {
        console.log('[BrowseAI] Starting to process incoming request...');

        // Validate webhook data structure
        if (!webhookData || !webhookData.task) {
            const error = new Error('Invalid webhook data: Missing task information');
            logger.error('[BrowseAI] Bad Request (400):', error);
            throw {
                status: 400,
                message: 'Invalid webhook data structure',
                details: 'The webhook payload is missing required task information',
            };
        }

        try {
            console.log('[BrowseAI] Webhook data:', webhookData.task.capturedLists);

            this.task = webhookData.task;
            const inputParams = this.task.inputParameters || {};
            const [firstKey, firstValue] = Object.entries(inputParams)[0] || [];

            const originUrl = (firstValue as string) || 'unknown';
            const docName = extractDomainIdentifier(originUrl);

            const timestamp = admin.firestore.Timestamp.fromDate(new Date());

            const batch = db.batch();

            console.log('[BrowseAI] Processing captured data...');

            if (this.task.capturedTexts && Object.keys(this.task.capturedTexts).length > 0) {
                await this.storeCapturedTexts(batch, docName, originUrl, this.task.capturedTexts);
            }

            if (this.task.capturedScreenshots && Object.keys(this.task.capturedScreenshots).length > 0) {
                await this.storeCapturedScreenshots(batch, docName, originUrl, this.task.capturedScreenshots);
            }

            if (this.task.capturedLists && Object.keys(this.task.capturedLists).length > 0) {
                await this.storeCapturedLists(batch, docName, originUrl, this.task.capturedLists);
            }

            // We can't access internal properties of the batch, so just log the commit
            console.log('[Firestore] Committing batch write...');
            const startTime = Date.now();
            await batch.commit();
            const duration = Date.now() - startTime;
            console.log(`[Firestore] Batch write successful! Completed in ${duration}ms`);

            return {
                success: true,
                meta: {
                    processedAt: timestamp.toDate().toISOString(),
                    collections: ['captured_texts', 'captured_screenshots', 'captured_lists'],
                },
            };
        } catch (error) {
            // If it's already a structured error with status, rethrow it
            if (error && typeof error === 'object' && 'status' in error) {
                throw error;
            }

            // Log and rethrow as a more detailed error
            logger.error('[BrowseAI] Error processing webhook data:', error);
            throw error;
        }
    }

    /**
     * Stores captured texts in Firestore using the provided batch.
     *
     * @param {WriteBatch} batch - Firestore batch instance.
     * @param {string} originUrl - Source URL of the captured data.
     * @param {any} texts - Captured text data.
     */
    private async storeCapturedTexts(
        batch: FirebaseFirestore.WriteBatch,
        docName: string,
        originUrl: string,
        texts: any,
    ): Promise<void> {
        console.log('[Texts] Processing captured texts...');
        const textsRef = this.db.collection('captured_texts').doc(docName);
        const textsData = convertToFirestoreFormat(texts);

        const docSnapshot = await textsRef.get();
        const existingData = docSnapshot.exists ? docSnapshot.data() : null;

        // Pass existing data and originUrl to cleanDataFields
        const processedData = cleanDataFields(textsData, existingData, originUrl, docName);

        if (docSnapshot.exists) {
            console.log(
                `[DB UPDATE] Updating document '${docName}' in collection 'captured_texts' with ${Object.keys(processedData).length} fields`,
            );
            const appendData = appendNewData(docSnapshot, processedData, originUrl);
            batch.set(textsRef, appendData);
        } else {
            // Document doesn't exist, create new document
            console.log(
                `[DB INSERT] Creating new document '${docName}' in collection 'captured_texts' with ${Object.keys(processedData).length} fields`,
            );
            const prepData = {
                data: {
                    ...processedData,
                },
            };
            batch.set(textsRef, prepData);
        }

        // Log array fields for better visibility
        Object.entries(processedData).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                console.log(`[DB Field] '${key}' contains ${value.length} items`);
            }
        });
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
        console.log('[Screenshots] Processing captured screenshots...');
        const screenshotsRef = this.db.collection('captured_screenshots').doc(docName);
        const screenshotsData = convertToFirestoreFormat(screenshots);
        const timestamp = admin.firestore.Timestamp.fromDate(new Date());

        const docSnapshot = await screenshotsRef.get();
        const existingData = docSnapshot.exists ? docSnapshot.data() : null;

        // Process the screenshots data
        const processedData = cleanDataFields(screenshotsData, existingData, originUrl, docName);

        if (docSnapshot.exists) {
            console.log(`[Screenshots] Updating existing document '${docName}'`);
            const appendData = appendNewData(docSnapshot, processedData, originUrl);
            batch.set(screenshotsRef, appendData);
        } else {
            console.log(`[Screenshots] Creating new document '${docName}'`);
            batch.set(screenshotsRef, {
                data: processedData,
                timestamp,
                originUrl,
            });
        }
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
        const listsRef = db.collection('captured_lists').doc(docName);

        // Check if this is OleMiss data
        const isOleMissData =
            docName === 'olemiss' || docName === 'olemisssports.com' || originUrl.includes('olemisssports.com');

        if (isOleMissData) {
            // OleMiss-specific processing path
            console.log(`[BrowseAI] Processing OleMiss data for ${docName} from ${originUrl}`);

            const processedData: Record<string, any> = {};

            // Process each list in the captured lists
            for (const [listName, listData] of Object.entries(lists)) {
                // Skip empty lists
                if (!listData || !Array.isArray(listData) || listData.length === 0) {
                    continue;
                }

                // Process sports items
                if (listData && Array.isArray(listData)) {
                    listData.forEach((item, index) => {
                        if (item && item.Sports) {
                            // Make sure uid is preserved or generated if missing
                            if (!item.uid) {
                                item.uid = `${listName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`;
                            }

                            // Apply OleMiss-specific sports processing
                            processSportsItem(item);

                            if (item.DetailSrc) {
                                // Create a temporary label object for processing
                                const tempLabel = { ...item };
                                processOleMissItem(item, tempLabel, listName, docName, originUrl);

                                // Copy any enhanced fields back to the original item
                                Object.assign(item, tempLabel);
                            }
                        }
                    });
                }

                // Process the data for this list
                console.log(`[BrowseAI] Applying OleMiss-specific processing for list: ${listName}`);
                processedData[listName] = cleanDataFields(listData, null, originUrl, docName);
            }

            // Store processed OleMiss data
            const docSnapshot = await listsRef.get();

            if (docSnapshot.exists) {
                const appendData = appendNewData(docSnapshot, processedData, originUrl);
                batch.set(listsRef, appendData);
            } else {
                const prepData = {
                    data: {
                        ...processedData,
                    },
                };
                batch.set(listsRef, prepData);
            }
        } else {
            // Standard processing path for non-OleMiss data
            const docSnapshot = await listsRef.get();
            const existingData = docSnapshot.exists ? docSnapshot.data() : null;

            const listsData = lists;
            const processedData = cleanDataFields(listsData, existingData, originUrl, docName);

            if (docSnapshot.exists) {
                const appendData = appendNewData(docSnapshot, processedData, originUrl);
                batch.set(listsRef, appendData);
            } else {
                const prepData = {
                    data: {
                        ...processedData,
                    },
                };
                batch.set(listsRef, prepData);
            }
        }
    }

    public static async fetchFromCollection(collection: string): Promise<string[]> {
        console.log(`[BrowseAI] Fetching from collection ${collection}...`);
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
        console.log(`[BrowseAI] Fetching document ${documentId} from collection ${collection}...`);
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
        console.log(`[BrowseAI] Deleting document ${documentId} from collection ${collection}...`);
        try {
            const docRef = db.collection(collection).doc(documentId);
            const docSnapshot = await docRef.get();

            if (!docSnapshot.exists) {
                throw new Error(`Document not found in collection '${collection}' with ID '${documentId}'`);
            }

            await docRef.delete();
            const deletedAt = new Date().toISOString();
            console.log(
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
