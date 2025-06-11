import express, { Request, Response, Router } from 'express';
import FirestoreService from '../../services/firestore';
import logger from '../../middlewares/logger';

const FIRESTORE_ROUTER: Router = express.Router();
const firestoreService = new FirestoreService();

/**
 * Helper function to find a category by name (case-insensitive)
 * @param collection Collection name
 * @param documentName Document name
 * @param subcategory Category to find
 * @returns The matched category name with correct case
 */
async function findMatchedCategory(collection: string, documentName: string, subcategory: string): Promise<string> {
    const result = await firestoreService.fetchCategoriesFromDocument(collection, documentName);
    
    // Find the actual category name with correct case
    const subcategoryLower = subcategory.toLowerCase();
    const foundCategory = result.categories?.find((category) => category.toLowerCase() === subcategoryLower);
    
    if (!foundCategory) {
        throw {
            status: 404,
            message: `Category '${subcategory}' not found`,
            availableCategories: result.categories
        };
    }
    
    return foundCategory;
}

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
FIRESTORE_ROUTER.get('/:collection/:documentName', async (req: Request, res: Response) => {
    try {
        const { collection, documentName } = req.params;

        const result = await firestoreService.fetchDocumentById(collection, documentName);

        if ('error' in result) {
            return res.status(404).json({ error: result.error });
        }

        res.json(result);
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
FIRESTORE_ROUTER.get('/:collection/:documentName/category', async (req: Request, res: Response) => {
    try {
        const { collection, documentName } = req.params;

        try {
            const result = await firestoreService.fetchCategoriesFromDocument(collection, documentName);
            res.json(result);
        } catch (error) {
            return res.status(404).json({ error: (error as Error).message });
        }
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
FIRESTORE_ROUTER.get('/:collection/:documentName/category=:subcategory', async (req: Request, res: Response) => {
    try {
        const { collection, documentName, subcategory } = req.params;
        
        try {
            // Find the matching category with correct case
            const matchedCategory = await findMatchedCategory(collection, documentName, subcategory);
            
            // Fetch the category data
            const categoryResult = await firestoreService.fetchCategoryData(collection, documentName, matchedCategory);
            res.json({ data: categoryResult, count: categoryResult.length });
        } catch (error: any) {
            if (error.status === 404) {
                return res.status(404).json({
                    error: error.message,
                    availableCategories: error.availableCategories
                });
            }
            return res.status(404).json({ error: (error as Error).message });
        }
    } catch (error) {
        logger.error(`Error fetching subcategory data from Firestore: ${error}`);
        res.status(500).json({ error: 'Failed to fetch subcategory data from Firestore' });
    }
});

/**
 * GET endpoint to fetch a limited number of items from a specific subcategory of a document in a Firestore collection.
 * The subcategory is matched case-insensitively against the document's available categories.
 *
 * @route GET /:collection/:documentId/:subcategory/count=:count
 * @param {Request} req - Express request object, expects `collection`, `documentId`, `subcategory`, and `count` as route parameters.
 * @param {Response} res - Express response object used to return limited subcategory data or an error message.
 *
 * @returns {JSON} - Returns limited subcategory data if a case-insensitive match is found.
 *
 * @throws {400} - If count parameter is invalid
 * @throws {404} - If the document, categories, or specified subcategory is not found.
 * @throws {500} - If an internal error occurs during the fetch operation.
 */
FIRESTORE_ROUTER.get('/:collection/:documentName/:subcategory/count=:count', async (req: Request, res: Response) => {
    try {
        const { collection, documentName, subcategory, count } = req.params;
        const countNum = parseInt(count, 10);

        if (isNaN(countNum) || countNum <= 0) {
            return res.status(400).json({ error: 'Count parameter must be a positive number' });
        }

        try {
            // Find the matching category with correct case
            const matchedCategory = await findMatchedCategory(collection, documentName, subcategory);
            
            // Fetch the category data and limit the results
            const categoryResult = await firestoreService.fetchCategoryData(collection, documentName, matchedCategory);
            const limitedResults = categoryResult.slice(0, countNum);
            
            res.json({
                data: limitedResults,
                count: limitedResults.length,
                totalAvailable: categoryResult.length,
            });
        } catch (error: any) {
            if (error.status === 404) {
                return res.status(404).json({
                    error: error.message,
                    availableCategories: error.availableCategories
                });
            }
            return res.status(404).json({ error: (error as Error).message });
        }
    } catch (error) {
        logger.error(`Error fetching limited subcategory data from Firestore: ${error}`);
        res.status(500).json({ error: 'Failed to fetch limited subcategory data from Firestore' });
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
        logger.error(`Error deleting document from Firestore: ${error}`);
        res.status(500).json({ error: 'Failed to delete document from Firestore' });
    }
});

export default FIRESTORE_ROUTER;
