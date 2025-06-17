import express, { Request, Response, Router } from 'express';
import FirestoreService from '../../services/firestore';
import logger from '../../middlewares/logger';
import { findMatchedCategory } from '../../utils/firestore.utils';
import { db } from '../../config/firebase';

const FIRESTORE_ROUTER: Router = express.Router();
const firestoreService = new FirestoreService();

/**
 * GET endpoint to fetch document IDs from a specified Firestore collection.
 *
 * @route GET /:collection
 * @param {Request} req - Express request object, expects `collection` as a route parameter.
 * @param {Response} res - Express response object used to send back JSON data or error.
 *
 * @returns {JSON} - Returns an array of document IDs from the specified Firestore collection.
 *
 * @throws {500} - If fetching document IDs fails, responds with a 500 status and error message.
 */
FIRESTORE_ROUTER.get('/:collection', async (req: Request, res: Response) => {
    try {
        const { collection } = req.params;
        const result = await firestoreService.fetchFromCollection(collection);
        if ('error' in result) {
            return res.status(500).json({ error: result.error });
        }
        res.json(result);
    } catch (error) {
        logger.error(`Error fetching from Firestore: ${error instanceof Error ? error.message : 'Unknown error'}`);
        res.status(500).json({ error: 'Failed to fetch document IDs from Firestore' });
    }
});

/**
 * GET endpoint to fetch a specific document by ID from a specified Firestore collection.
 *
 * @route GET /:collection/:documentId
 * @param {Request} req - Express request object, expects `collection` and `documentId` as route parameters.
 * @param {Response} res - Express response object used to return the document or an error message.
 *
 * @returns {JSON} - Returns the document data if found.
 *
 * @throws {404} - If the document is not found in the specified collection.
 * @throws {500} - If an error occurs while fetching the document.
 */
FIRESTORE_ROUTER.get('/:collection/:documentName', async (req: Request, res: Response) => {
    try {
        const { collection, documentName } = req.params;

        const result = await firestoreService.fetchDocumentById(collection, documentName);

        if ('error' in result) {
            return res.status(404).json({ error: result.error });
        }

        // Format the result with standardized fields
        const formattedResult = firestoreService.formatResult(result, documentName);
        res.json(formattedResult);
    } catch (error) {
        logger.error(
            `Error fetching document from Firestore: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        res.status(500).json({ error: 'Failed to fetch document from Firestore' });
    }
});

/**
 * GET endpoint to fetch categories from a specific document in a Firestore collection.
 *
 * @route GET /:collection/:documentId/category
 * @param {Request} req - Express request object, expects `collection` and `documentId` as route parameters.
 * @param {Response} res - Express response object used to return the categories or an error message.
 *
 * @returns {JSON} - Returns a result object containing categories if successful.
 *
 * @throws {404} - If categories cannot be fetched or document is not found (based on service result).
 * @throws {500} - If an internal error occurs during the fetch operation.
 */
FIRESTORE_ROUTER.get('/:collection/:documentName/category', async (req: Request, res: Response) => {
    try {
        const { collection, documentName } = req.params;

        try {
            // Get the document from Firestore
            const docRef = await db.collection(collection).doc(documentName).get();

            if (!docRef.exists) {
                return res.status(404).json({ error: 'Document not found' });
            }

            const data = docRef.data();
            if (!data || !data.data) {
                return res.status(404).json({ error: 'Document has no data' });
            }

            // Get the data object which contains the arrays
            const docData = data.data || {};

            // Find all keys that are arrays
            const categories = Object.keys(docData).filter((key) => Array.isArray(docData[key]));

            // Return only the array names as a simple array
            res.json(categories);
        } catch (error: any) {
            res.status(404).json({ error: error.message });
        }
    } catch (error) {
        logger.error(
            `Error fetching categories from Firestore: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        res.status(500).json({ error: 'Failed to fetch categories from Firestore' });
    }
});

/**
 * GET endpoint to fetch data from a specific subcategory of a document in a Firestore collection.
 * Supports optional query parameters for count limitation and date range filtering.
 *
 * @route GET /:collection/:documentName/category=:subcategory
 * @param {Request} req - Express request object, expects `collection`, `documentName`, and `subcategory` as route parameters.
 *                         Optional query parameters:
 *                         - `count`: Limits the number of items returned
 *                         - `from`: Start date for date range filtering (ISO format YYYY-MM-DD)
 *                         - `to`: End date for date range filtering (ISO format YYYY-MM-DD, defaults to current date)
 * @param {Response} res - Express response object used to return filtered data or an error message.
 *
 * @returns {JSON} - Returns subcategory data, optionally filtered by count and/or date range.
 *
 * @example
 * // Basic usage - returns all items in the category
 * GET /captured_lists/olemisssports.com/category=ole
 *
 * // Limit to 5 items
 * GET /captured_lists/olemisssports.com/category=ole?count=5
 *
 * // Get all events between June 1st and June 30th, 2025
 * GET /captured_lists/olemisssports.com/category=ole?from=2025-06-01&to=2025-06-30
 *
 * // Get 10 events starting from June 1st, 2025
 * GET /captured_lists/olemisssports.com/category=ole?from=2025-06-01&count=10
 */
FIRESTORE_ROUTER.get('/:collection/:documentName/:subcategory', async (req: Request, res: Response) => {
    try {
        const { collection, documentName, subcategory } = req.params;
        const { from, to, count } = req.query;

        // Parse count parameter if provided
        let countNum: number | undefined;
        if (count !== undefined) {
            countNum = parseInt(count as string, 10);
            if (isNaN(countNum) || countNum <= 0) {
                return res.status(400).json({ error: 'Count parameter must be a positive number' });
            }
        }

        // Parse dates if provided
        let fromDate: Date | undefined;
        let toDate: Date | undefined;

        if (from) {
            fromDate = new Date(from as string);
            if (isNaN(fromDate.getTime())) {
                return res.status(400).json({ error: 'Invalid from date format. Use ISO format (YYYY-MM-DD)' });
            }

            // Set toDate if 'to' is provided, otherwise default to current date
            toDate = to ? new Date(to as string) : new Date();
            if (isNaN(toDate.getTime())) {
                return res.status(400).json({ error: 'Invalid to date format. Use ISO format (YYYY-MM-DD)' });
            }
        }

        try {
            // Find the matching category with correct case
            const matchedCategory = await findMatchedCategory(collection, documentName, subcategory);

            // Process the subcategory data using the service
            const processedData = await firestoreService.processSubcategoryData(
                collection,
                documentName,
                matchedCategory,
                fromDate,
                toDate,
                countNum,
            );

            res.json(processedData);
        } catch (error: any) {
            if (error.status === 404) {
                return res.status(404).json({
                    error: error.message,
                    availableCategories: error.availableCategories,
                });
            }
            return res.status(404).json({ error: (error as Error).message });
        }
    } catch (error) {
        logger.error(`Error fetching date range data from Firestore: ${error}`);
        res.status(500).json({ error: 'Failed to fetch date range data from Firestore' });
    }
});

/**
 * PUT endpoint to update the ImageUrl array of an item based on its uid
 *
 * @route PUT /update-image
 * @param {Request} req - Express request object. Expects `uid` and `ImageUrl` in the request body.
 * @param {Response} res - Express response object used to return update status or an error message.
 *
 * @returns {JSON} - Returns a result object indicating successful update or error details.
 *
 * @throws {400} - If required parameters are missing or invalid.
 * @throws {404} - If the item with specified uid is not found in any collection.
 * @throws {500} - If an internal server error occurs during the update process.
 */
FIRESTORE_ROUTER.put('/:collection/:documentName/:subcategory/update-image', async (req: Request, res: Response) => {
    try {
        const { uid, ImageUrl } = req.body;

        // Validate required parameters
        if (!uid || !ImageUrl) {
            return res.status(400).json({ error: 'Missing required parameters: uid and ImageUrl are required' });
        }

        // Update the image URL
        const result = await firestoreService.updateImageByUid(uid, ImageUrl);

        if ('error' in result) {
            return res.status(404).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error(
            `Error updating image URL in Firestore: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        res.status(500).json({ error: 'Failed to update image URL in Firestore' });
    }
});

/**
 * DELETE endpoint to remove a specific document from a Firestore collection.
 *
 * @route DELETE /:collection/:documentId
 * @param {Request} req - Express request object. Expects `collection` and `documentId` as route parameters.
 * @param {Response} res - Express response object used to return deletion status or an error message.
 *
 * @returns {JSON} - Returns a result object indicating successful deletion.
 *
 * @throws {404} - If the document could not be found or deleted.
 * @throws {500} - If an internal server error occurs during the deletion process.
 */
FIRESTORE_ROUTER.delete('/:collection/:documentName', async (req: Request, res: Response) => {
    try {
        const { collection, documentName } = req.params;

        const result = await firestoreService.deleteDocumentById(collection, documentName);

        if ('error' in result) {
            return res.status(404).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error(
            `Error deleting document from Firestore: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        res.status(500).json({ error: 'Failed to delete document from Firestore' });
    }
});

/**
 * POST endpoint to remove duplicate items from a specific subcategory in a document
 * Duplicates are identified based on having the same Title, Location, Date, and EventDate
 *
 * @route POST /:collection/:documentName/category=:subcategory/remove-duplicates
 * @param {Request} req - Express request object. Expects collection, documentName, and subcategory as route parameters.
 * @param {Response} res - Express response object used to return removal status or an error message.
 *
 * @returns {JSON} - Returns a result object indicating successful removal with count of removed duplicates.
 *
 * @throws {400} - If required parameters are missing or invalid.
 * @throws {404} - If the document or subcategory is not found.
 * @throws {500} - If an internal server error occurs during the removal process.
 */
FIRESTORE_ROUTER.post(
    '/:collection/:documentName/category=:subcategory/remove-duplicates',
    async (req: Request, res: Response) => {
        try {
            const { collection, documentName, subcategory } = req.params;

            // Validate required parameters
            if (!collection || !documentName || !subcategory) {
                return res.status(400).json({
                    error: 'Missing required parameters: collection, documentName, and subcategory are required',
                });
            }

            // Call the service to remove duplicates
            const result = await firestoreService.removeDuplicates(collection, documentName, subcategory);

            if ('error' in result) {
                return res.status(404).json({ error: result.error });
            }

            res.json(result);
        } catch (error) {
            logger.error(
                `Error removing duplicates from Firestore: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            res.status(500).json({ error: 'Failed to remove duplicates from Firestore' });
        }
    },
);

export default FIRESTORE_ROUTER;
