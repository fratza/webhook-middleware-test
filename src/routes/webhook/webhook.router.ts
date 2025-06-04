import { Router, Request, Response } from 'express';
import logger from '../../middlewares/logger';
import { admin, db } from '../../config/firebase';
import { BrowseAIService } from '../../services/browseAI/browseAI.service';
import FirestoreService from '../../services/firestore';

const WEBHOOK_ROUTER = Router();
const browseAIService = new BrowseAIService();
const firestoreService = new FirestoreService(db);

/**
 * Handles incoming POST requests to dynamic webhook endpoints under `/api/webhook/:webhookId`.
 *
 * Currently supports:
 * - `browseAI`: Processes webhook data using the `BrowseAIService`.
 *
 * Example usage:
 * - POST to `/api/webhook/browseAI` with JSON payload
 *
 * @route POST /api/webhook/:webhookId
 * @param {Request} req - The Express request object containing webhook data and params.
 * @param {Response} res - The Express response object used to send responses.
 * @returns {void} Sends a JSON response indicating success or failure.
 */
WEBHOOK_ROUTER.post('/:webhookId', async (req: Request, res: Response) => {
    const webhookId = req.params.webhookId;
    console.log('[Webhook] Incoming request at URL:', webhookId);

    // BrowseAI Webhook
    if (webhookId.toLowerCase() === 'browseai') {
        try {
            logger.info('[BrowseAI Webhook] Received request');

            const result = await browseAIService.processWebhookData(req.body);

            res.json(result);
        } catch (error) {
            logger.error('[BrowseAI Webhook] Error:', error);

            res.status(500).json({
                success: false,
                error: (error as Error).message || 'Error processing BrowseAI webhook data',
            });
        }
    }
});

/**
 * Fetches document IDs from a specified Firestore collection.
 *
 * @route GET /api/firestore/:collection
 * @param {Request} req - The Express request object containing the collection name.
 * @param {Response} res - The Express response object used to send responses.
 * @returns {void} Sends a JSON response containing the document IDs or an error message.
 */
WEBHOOK_ROUTER.get('/api/firestore/:collection', async (req: Request, res: Response) => {
    try {
        const { collection } = req.params;
        const documentIds = await BrowseAIService.fetchFromCollection(collection);
        res.json(documentIds);
    } catch (error) {
        console.error('Error fetching from Firestore:', error);
        res.status(500).json({ error: 'Failed to fetch document IDs from Firestore' });
    }
});

/**
 * Fetches a specific document from Firestore by its collection and documentId.
 *
 * @route GET /api/firestore/:collection/:documentId
 * @param {Request} req - The Express request object containing collection and documentId params.
 * @param {Response} res - The Express response object used to send responses.
 * @returns {void} Sends a JSON response with the document data or an error message.
 */
WEBHOOK_ROUTER.get('/api/firestore/:collection/:documentId', async (req: Request, res: Response) => {
    try {
        const { collection, documentId } = req.params;

        // Use the service method to fetch the document
        const document = await BrowseAIService.fetchDocumentById(collection, documentId);
        res.json(document);
    } catch (error) {
        console.error('Error fetching document from Firestore:', error);
        if ((error as Error).message.includes('Document not found')) {
            return res.status(404).json({ error: (error as Error).message });
        }
        res.status(500).json({ error: 'Failed to fetch document from Firestore' });
    }
});

/**
 * Deletes a specific document from Firestore by its collection and documentId.
 *
 * @route DELETE /api/firestore/:collection/:documentId
 * @param {Request} req - The Express request object containing collection and documentId params.
 * @param {Response} res - The Express response object used to send responses.
 * @returns {void} Sends a JSON response with deletion status or an error message.
 */
WEBHOOK_ROUTER.delete('/api/firestore/:collection/:documentId', async (req: Request, res: Response) => {
    try {
        const { collection, documentId } = req.params;

        // Use the service method to delete the document
        const result = await BrowseAIService.deleteDocumentById(collection, documentId);
        res.json(result);
    } catch (error) {
        console.error('Error deleting document from Firestore:', error);
        if ((error as Error).message.includes('Document not found')) {
            return res.status(404).json({ error: (error as Error).message });
        }
        res.status(500).json({ error: 'Failed to delete document from Firestore' });
    }
});

/**
 * Fetches categories (array names) from a document
 *
 * @route GET /api/firestore/:collection/:documentId/category
 * @param {Request} req - The Express request object containing collection and documentId params
 * @param {Response} res - The Express response object used to send responses
 * @returns {void} Sends a JSON response with the categories or an error message
 */
WEBHOOK_ROUTER.get('/api/firestore/:collection/:documentId/category', async (req: Request, res: Response) => {
    try {
        const { collection, documentId } = req.params;

        const result = await firestoreService.fetchCategoriesFromDocument(collection, documentId);

        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error(`Error fetching categories from Firestore: ${error}`);
        res.status(500).json({ error: 'Failed to fetch categories from Firestore' });
    }
});

/**
 * Fetches data from a specific category with case-insensitive matching
 *
 * @route GET /api/firestore/:collection/:documentId/category=:subcategory
 * @param {Request} req - The Express request object containing collection, documentId, and subcategory params
 * @param {Response} res - The Express response object used to send responses
 * @returns {void} Sends a JSON response with the category data or an error message
 */
WEBHOOK_ROUTER.get(
    '/api/firestore/:collection/:documentId/category=:subcategory',
    async (req: Request, res: Response) => {
        try {
            const { collection, documentId, subcategory } = req.params;

            // Make subcategory case-insensitive by converting to lowercase
            const result = await firestoreService.fetchCategoriesFromDocument(collection, documentId);

            if (!result.success) {
                return res.status(404).json({ error: result.error });
            }

            // Find the actual category name with correct case
            const subcategoryLower = subcategory.toLowerCase();
            const matchedCategory = result.categories?.find((category) => category.toLowerCase() === subcategoryLower);

            if (!matchedCategory) {
                return res.status(404).json({
                    error: `Category '${subcategory}' not found`,
                    availableCategories: result.categories,
                });
            }

            // Use the correctly cased category name for the data fetch
            const categoryResult = await firestoreService.fetchCategoryData(collection, documentId, matchedCategory);

            if (!categoryResult.success) {
                return res.status(404).json({ error: categoryResult.error });
            }

            res.json(categoryResult);
        } catch (error) {
            logger.error(`Error fetching subcategory data from Firestore: ${error}`);
            res.status(500).json({ error: 'Failed to fetch subcategory data from Firestore' });
        }
    },
);

/**
 * Fetches data from a specific category in a document
 *
 * @route GET /api/firestore/:collection/:documentId/:categoryName
 * @param {Request} req - The Express request object containing collection, documentId, and categoryName params
 * @param {Response} res - The Express response object used to send responses
 * @returns {void} Sends a JSON response with the category data or an error message
 */
WEBHOOK_ROUTER.get('/api/firestore/:collection/:documentId/:categoryName', async (req: Request, res: Response) => {
    try {
        const { collection, documentId, categoryName } = req.params;

        // Skip if the categoryName is 'category' as it's handled by another route
        if (categoryName === 'category') {
            return res.status(404).json({ error: 'Use /category endpoint instead' });
        }

        const result = await firestoreService.fetchCategoryData(collection, documentId, categoryName);

        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error(`Error fetching category data from Firestore: ${error}`);
        res.status(500).json({ error: 'Failed to fetch category data from Firestore' });
    }
});

/**
 * Tests the webhook service status
 *
 * @route GET /api/webhook/status
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object used to send responses
 * @returns {void} Sends a JSON response with the webhook service status
 */
WEBHOOK_ROUTER.get('/api/webhook/status', (req: Request, res: Response) => {
    try {
        // Get server uptime
        const uptime = process.uptime();

        // Format uptime
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const formattedUptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        // Return status information
        res.json({
            status: 'ok',
            message: 'Webhook service is running',
            timestamp: new Date().toISOString(),
            uptime: formattedUptime,
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
        });
    } catch (error) {
        logger.error(`Error checking webhook status: ${error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to check webhook status',
            error: (error as Error).message,
        });
    }
});

export default WEBHOOK_ROUTER;
