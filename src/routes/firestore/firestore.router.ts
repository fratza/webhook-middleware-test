import express, { Request, Response, Router } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import FirestoreService from '../../services/firestore';
import logger from '../../middlewares/logger';

const FIRESTORE_ROUTER: Router = express.Router();
const firestoreService = new FirestoreService(getFirestore());

// Get all document IDs from a collection
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

// Get a specific document by ID
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

// Get all categories from a document
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

// Get data from a specific subcategory (case-insensitive matching)
FIRESTORE_ROUTER.get('/:collection/:documentName/category=:subcategory', async (req: Request, res: Response) => {
    try {
        const { collection, documentName, subcategory } = req.params;

        // Step 1: Find the correct case for the category
        let matchedCategory: string;
        try {
            const result = await firestoreService.fetchCategoriesFromDocument(collection, documentName);
            const subcategoryLower = subcategory.toLowerCase();
            const foundCategory = result.categories?.find((category) => category.toLowerCase() === subcategoryLower);

            if (!foundCategory) {
                return res.status(404).json({
                    error: `Category '${subcategory}' not found`,
                    availableCategories: result.categories,
                });
            }

            matchedCategory = foundCategory;
        } catch (error) {
            return res.status(404).json({ error: (error as Error).message });
        }

        // Step 2: Fetch data using the correctly cased category name
        try {
            const categoryResult = await firestoreService.fetchCategoryData(collection, documentName, matchedCategory);
            res.json({ data: categoryResult, count: categoryResult.length });
        } catch (error) {
            return res.status(404).json({ error: (error as Error).message });
        }
    } catch (error) {
        logger.error(`Error fetching subcategory data from Firestore: ${error}`);
        res.status(500).json({ error: 'Failed to fetch subcategory data from Firestore' });
    }
});

// Get limited data from a specific subcategory with count parameter
FIRESTORE_ROUTER.get(
    '/:collection/:documentName/category/:subcategory/count=:count',
    async (req: Request, res: Response) => {
        try {
            const { collection, documentName, subcategory, count } = req.params;
            const limit = parseInt(count, 10);

            // Validate count parameter
            if (isNaN(limit) || limit <= 0) {
                return res.status(400).json({
                    error: 'Count parameter must be a positive number',
                });
            }

            // Step 1: Find the correct case for the category
            let matchedCategory: string;
            try {
                const result = await firestoreService.fetchCategoriesFromDocument(collection, documentName);
                const subcategoryLower = subcategory.toLowerCase();
                const foundCategory = result.categories?.find(
                    (category) => category.toLowerCase() === subcategoryLower,
                );

                if (!foundCategory) {
                    return res.status(404).json({
                        error: `Category '${subcategory}' not found`,
                        availableCategories: result.categories,
                    });
                }

                matchedCategory = foundCategory;
            } catch (error) {
                return res.status(404).json({ error: (error as Error).message });
            }

            try {
                const categoryResult = await firestoreService.fetchCategoryData(
                    collection,
                    documentName,
                    matchedCategory,
                );

                // Limit the results based on count parameter
                const limitedResults = categoryResult.slice(0, limit);

                res.json({
                    data: limitedResults,
                    count: limitedResults.length,
                    totalAvailable: categoryResult.length,
                });
            } catch (error) {
                return res.status(404).json({ error: (error as Error).message });
            }
        } catch (error) {
            logger.error(`Error fetching limited subcategory data from Firestore: ${error}`);
            res.status(500).json({ error: 'Failed to fetch limited subcategory data from Firestore' });
        }
    },
);

// Delete a document by ID
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

// Update imageURL for a document with specific uid
FIRESTORE_ROUTER.put('/:collection/update-image', async (req: Request, res: Response) => {
    try {
        const { collection } = req.params;
        const { uid, imageURL } = req.body;

        // Validate required fields
        if (!uid || !imageURL) {
            return res.status(400).json({
                error: 'Missing required fields: uid and imageURL are required',
            });
        }

        const result = await firestoreService.updateImageURL(collection, uid, imageURL);

        if ('error' in result) {
            return res.status(404).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error(`Error updating imageURL in Firestore: ${error}`);
        res.status(500).json({ error: 'Failed to update imageURL in Firestore' });
    }
});

export default FIRESTORE_ROUTER;
