import { admin, db } from '../../config/firebase';
import { Firestore } from 'firebase-admin/firestore';
import { convertToFirestoreFormat } from '../../utils/firestore';
import { BrowseAIWebhookData } from '../../interfaces';
import { appendNewData, extractDomainIdentifier, cleanDataFields } from '../../utils/browseai';

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
        console.log('[BrowseAI] Webhook data:', webhookData.task.capturedLists);

        this.task = webhookData?.task;
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
        console.log('[Lists] Processing captured lists...');

        const listsRef = this.db.collection('captured_lists').doc(docName);
        const listsData = convertToFirestoreFormat(lists);

        const docSnapshot = await listsRef.get();
        const existingData = docSnapshot.exists ? docSnapshot.data() : null;

        const processedData = cleanDataFields(listsData, existingData, originUrl, docName);

        if (docSnapshot.exists) {
            console.log(
                `[DB UPDATE] Updating document '${docName}' in collection 'captured_lists' with ${Object.keys(processedData).length} fields`,
            );
            const appendData = appendNewData(docSnapshot, processedData, originUrl);
            batch.set(listsRef, appendData);
        } else {
            console.log(
                `[DB INSERT] Creating new document '${docName}' in collection 'captured_lists' with ${Object.keys(processedData).length} fields`,
            );
            const prepData = {
                data: {
                    ...processedData,
                },
            };
            batch.set(listsRef, prepData);
        }

        // Log array fields for better visibility
        Object.entries(processedData).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                console.log(`[DB Field] '${key}' contains ${value.length} items`);
            }
        });
    }

    public static async fetchFromCollection(collection: string): Promise<string[]> {
        console.log(`[BrowseAI] Fetching from collection ${collection}...`);
        try {
            const collectionRef = db.collection(collection);
            const snapshot = await collectionRef.get();
            const documentIds = snapshot.docs.map((doc) => doc.id);
            return documentIds;
        } catch (error) {
            console.error(`Error fetching from collection ${collection}:`, error);
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
            console.error(`Error fetching document ${documentId} from collection ${collection}:`, error);
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
            console.error(`Error deleting document ${documentId} from collection ${collection}:`, error);
            throw error;
        }
    }
}
