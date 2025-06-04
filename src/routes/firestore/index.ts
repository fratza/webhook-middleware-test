import express, { Request, Response, Router } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import FirestoreService from '../../services/firestore';
import logger from '../../middlewares/logger';

const router: Router = express.Router();
const firestoreService = new FirestoreService(getFirestore());

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
router.get('/:collection', async (req: Request, res: Response) => {
    try {
        const { collection } = req.params;
        const documentIds = await firestoreService.fetchFromCollection(collection);
        res.json(documentIds);
    } catch (error) {
        logger.error(`Error fetching from Firestore: ${error}`);
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
router.get('/:collection/:documentId', async (req: Request, res: Response) => {
    try {
        const { collection, documentId } = req.params;

        const document = await firestoreService.fetchDocumentById(collection, documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json(document);
    } catch (error) {
        logger.error(`Error fetching document from Firestore: ${error}`);
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
router.get('/:collection/:documentId/category', async (req: Request, res: Response) => {
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
 * GET endpoint to fetch data from a specific subcategory of a document in a Firestore collection.
 * The subcategory is matched case-insensitively against the document's available categories.
 *
 * @route GET /:collection/:documentId/category=:subcategory
 * @param {Request} req - Express request object, expects `collection`, `documentId`, and `subcategory` as route parameters.
 * @param {Response} res - Express response object used to return subcategory data or an error message.
 *
 * @returns {JSON} - Returns subcategory data if a case-insensitive match is found.
 *
 * @throws {404} - If the document, categories, or specified subcategory is not found.
 * @throws {500} - If an internal error occurs during the fetch operation.
 */
router.get('/:collection/:documentId/category=:subcategory', async (req: Request, res: Response) => {
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
});

/**
 * GET endpoint to fetch data for a specific category of a Firestore document.
 *
 * NOTE: If the `categoryName` is 'category', this route returns an error instructing to use the `/category` endpoint instead.
 *
 * @route GET /:collection/:documentId/:categoryName
 * @param {Request} req - Express request object. Expects `collection`, `documentId`, and `categoryName` as route parameters.
 * @param {Response} res - Express response object used to return category data or an error message.
 *
 * @returns {JSON} - Returns category-specific data if retrieval is successful.
 *
 * @throws {404} - If the `categoryName` is 'category', or if the category data is not found.
 * @throws {500} - If an internal server error occurs during the fetch.
 */
router.get('/:collection/:documentId/:categoryName', async (req: Request, res: Response) => {
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
router.delete('/:collection/:documentId', async (req: Request, res: Response) => {
    try {
        const { collection, documentId } = req.params;

        const result = await firestoreService.deleteDocumentById(collection, documentId);

        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error(`Error deleting document from Firestore: ${error}`);
        res.status(500).json({ error: 'Failed to delete document from Firestore' });
    }
});

export default router;
