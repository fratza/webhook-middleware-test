import { admin, db, getFirestore } from '../../config/firebase';
import { filterItemsByDate } from '../../utils/firestore.utils';
import { Firestore } from 'firebase-admin/firestore';
import { ErrorResponse, StandardResponse, CustomResponse } from '../../dto/firestore.dto';
import { cacheProvider } from '../../middlewares/cache';

// List of document names that require custom fields in the response
const CUSTOM_DOCUMENTS = ['olemisssports.com'];

/**
 * Service for handling Firestore operations
 */

class FirestoreService {
    private _db: Firestore;
    private databaseId?: string;
    // Default cache TTL in seconds (5 minutes)
    private static CACHE_TTL = 300;

    /**
     * Get the Firestore database instance
     */
    get db(): Firestore {
        return this._db;
    }

    /**
     * Constructor for FirestoreService
     * @param databaseId Optional database ID to use for Firestore operations
     */
    constructor(databaseId?: string) {
        this.databaseId = databaseId;
        this._db = databaseId ? getFirestore(databaseId) : db;
    }

    /**
     * Fetches all document IDs from a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection to query.
     * @returns {Promise<string[] | ErrorResponse>} - A promise that resolves to an array of document IDs or an error response
     */
    public async fetchFromCollection(collection: string): Promise<string[] | ErrorResponse> {
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
    public async fetchDocumentById(collection: string, documentId: string): Promise<any | ErrorResponse> {
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
    public async deleteDocumentById(
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
            // Create a cache key
            const cacheKey = `category:${collection}:${documentId}:${categoryName}`;

            // Try to get data from cache first
            const cachedData = await cacheProvider.get(cacheKey);
            if (cachedData) {
                // Return cached data if it exists
                return this.sortCategoryData(cachedData);
            }

            // If no cache, fetch from Firestore
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

            // Cache the result
            await cacheProvider.set(cacheKey, docData[categoryName], FirestoreService.CACHE_TTL);

            // Sort the data in descending order by publishedDate or createdAt
            return this.sortCategoryData(docData[categoryName]);
        } catch (error) {
            console.error(`Error fetching category data from Firestore: ${error}`);
            throw error;
        }
    }

    /**
     * Process subcategory data with filtering, field normalization, and sorting
     * @param collection Collection name
     * @param documentName Document name
     * @param subcategory Subcategory name
     * @param fromDate Optional start date for filtering
     * @param toDate Optional end date for filtering
     * @param count Optional limit on number of items
     * @returns Processed and formatted data
     */
    async processSubcategoryData(
        collection: string,
        documentName: string,
        subcategory: string,
        fromDate?: Date,
        toDate?: Date,
        count?: number,
    ): Promise<any[]> {
        // Fetch the category data
        const data = await this.fetchCategoryData(collection, documentName, subcategory);

        // Apply date range filter if dates are provided
        let filteredData = data as any[];

        // Use the utility function to filter items by date
        filteredData = filterItemsByDate(filteredData, fromDate, toDate);

        // Apply count limit if specified - do this early to avoid unnecessary processing
        if (count !== undefined && filteredData.length > count) {
            filteredData = filteredData.slice(0, count);
        }

        // Use a Map to cache formatted responses for better performance with large datasets
        const formattedDataCache = new Map<string, any>();
        const isCustomDocument = documentName === 'olemisssports.com';

        // Ensure each item has all required fields and format in one pass
        const formattedData = filteredData.map((item, index) => {
            const typedItem = item as Record<string, any>;
            const itemUid = typedItem.uid || `${subcategory.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`;

            // Check if we've already formatted an item with this UID
            if (formattedDataCache.has(itemUid)) {
                return formattedDataCache.get(itemUid);
            }

            // Generate a UID if one doesn't exist
            if (!typedItem.uid) {
                typedItem.uid = itemUid;
            }

            // Ensure required fields exist with a more efficient approach
            if (!typedItem.Title) typedItem.Title = typedItem.title || typedItem.name || '';
            if (!typedItem.Location) typedItem.Location = typedItem.location || '';
            if (!typedItem.Description) typedItem.Description = typedItem.description || typedItem.summary || '';
            if (!typedItem.ImageUrl)
                typedItem.ImageUrl = typedItem.imageUrl || typedItem.image || typedItem.images || [];
            if (!typedItem.Link) typedItem.Link = typedItem.link || typedItem.url || '';

            // Format the item
            const formattedItem = this.createStandardResponse(typedItem, isCustomDocument);

            // Cache the formatted response
            formattedDataCache.set(itemUid, formattedItem);

            return formattedItem;
        });

        // Sort by date in descending order (latest date on top)
        return this.sortCategoryData(formattedData);
    }

    /**
     * Creates a standardized response object with required fields
     * @param item - The source data object
     * @param includeCustomFields - Whether to include additional fields for custom documents
     * @returns A formatted object with standardized fields
     */
    createStandardResponse(
        item: Record<string, any>,
        includeCustomFields: boolean = false,
    ): StandardResponse | CustomResponse {
        // Standard fields that all responses should have
        const standardResponse: StandardResponse = {
            uid: item.uid || '',
            Title: item.Title || '',
            Location: item.Location || '',
            Date: item.Date || '',
            Description: item.Description || '',
            ImageUrl: Array.isArray(item.ImageUrl) ? item.ImageUrl : item.ImageUrl ? [item.ImageUrl] : [],
            Link: item.Link || '',
        };

        // Add custom fields if needed
        if (includeCustomFields) {
            return {
                ...standardResponse,
                Logo: item.Logo || '',
                Sports: item.Sports || '',
                Score: item.Score || '',
                EventDate: item.EventDate || '',
                EventEndDate: item.EventEndDate || '',
            };
        }

        return standardResponse;
    }

    /**
     * Formats the result based on its type and whether custom fields are needed
     * @param result - The data to format (array, object, or other)
     * @param documentName - The name of the document being processed
     * @returns Formatted result with standardized fields
     */
    formatResult(result: any, documentName: string): any {
        const needsCustomFields = CUSTOM_DOCUMENTS.includes(documentName);

        // Handle array results
        if (Array.isArray(result)) {
            return result.map((item) => this.createStandardResponse(item, needsCustomFields));
        }
        // Handle object results
        else if (typeof result === 'object' && result !== null) {
            return this.createStandardResponse(result, needsCustomFields);
        }
        // For any other type, return as is
        else {
            return result;
        }
    }

    /**
     * Sorts category data by date fields in descending order (newest first)
     * @param items Array of items to sort
     * @returns Sorted array
     */
    private sortCategoryData(items: any[]): any[] {
        // Early return for empty or single-item arrays
        if (!items || items.length <= 1) {
            return items || [];
        }

        // Optimize date comparison by pre-computing timestamps
        const itemsWithTimestamp = items.map((item) => {
            const date = item.Date ? new Date(item.Date) : null;
            const timestamp = date && !isNaN(date.getTime()) ? date.getTime() : null;
            return { item, timestamp };
        });

        // Sort using pre-computed timestamps
        itemsWithTimestamp.sort((a, b) => {
            // If both timestamps exist, compare them
            if (a.timestamp && b.timestamp) {
                return b.timestamp - a.timestamp;
            }

            // If one timestamp exists, prioritize it
            if (a.timestamp) return -1;
            if (b.timestamp) return 1;

            // If no timestamps, maintain original order
            return 0;
        });

        // Return just the items
        return itemsWithTimestamp.map((wrapper) => wrapper.item);
    }

    /**
     * Updates the ImageUrl array of an item based on its uid
     *
     * @param {string} uid - The unique identifier of the item to update
     * @param {string[]} imageUrl - The new image URLs to set (array of strings)
     * @returns {Promise<{success: boolean; message: string} | ErrorResponse>} - A promise that resolves to a success object or an error response
     */
    async updateImageByUid(
        uid: string,
        imageUrl: string[],
    ): Promise<{ success: boolean; message: string } | ErrorResponse> {
        try {
            // Ensure imageUrl is always an array
            if (!Array.isArray(imageUrl)) {
                console.warn('ImageUrl is not an array, converting to array');
                imageUrl = [imageUrl as unknown as string];
            }

            // Query to find the document containing the item with the given uid
            const querySnapshot = await this.db.collectionGroup('data').get();
            let found = false;

            // Iterate through all documents to find the one containing the item with the given uid
            for (const doc of querySnapshot.docs) {
                const data = doc.data();
                if (!data) continue;

                // Get the parent document reference
                const parentRef = doc.ref.parent.parent;
                if (!parentRef) continue;

                // Get the parent document data
                const parentDoc = await parentRef.get();
                const parentData = parentDoc.data();
                if (!parentData || !parentData.data) continue;

                // Check all subcategories in the document
                for (const [subcategory, items] of Object.entries(parentData.data)) {
                    if (!Array.isArray(items)) continue;

                    // Find the item with the matching uid
                    const itemIndex = items.findIndex((item: any) => item.uid === uid);
                    if (itemIndex !== -1) {
                        // Update the ImageUrl field for the found item
                        await parentRef.update({
                            [`data.${subcategory}.${itemIndex}.ImageUrl`]: imageUrl,
                        });

                        found = true;
                        return {
                            success: true,
                            message: `ImageUrl updated successfully for item with uid '${uid}'`,
                        };
                    }
                }
            }

            if (!found) {
                return { error: `Item with uid '${uid}' not found in any collection` };
            }

            return {
                success: true,
                message: `ImageUrl updated successfully for item with uid '${uid}'`,
            };
        } catch (error) {
            console.error(`Error updating image URL in Firestore: ${error}`);
            return { error: `Failed to update image URL: ${error}` };
        }
    }

    /**
     * Removes duplicate items from a specific subcategory in a document based on specified criteria
     *
     * @param {string} collection - The name of the Firestore collection
     * @param {string} documentName - The name of the document containing the data
     * @param {string} subcategory - The subcategory to remove duplicates from
     * @returns {Promise<{success: boolean; message: string; removed: number} | ErrorResponse>} - A promise that resolves to a success object with count of removed duplicates or an error response
     */
    async removeDuplicates(
        collection: string,
        documentName: string,
        subcategory: string,
    ): Promise<{ success: boolean; message: string; removed: number } | ErrorResponse> {
        try {
            // Get the document reference
            const docRef = this.db.collection(collection).doc(documentName);
            const doc = await docRef.get();

            if (!doc.exists) {
                return { error: 'Document not found' };
            }

            const docData = doc.data();
            if (!docData || !docData.data || !docData.data[subcategory]) {
                return { error: `Subcategory '${subcategory}' not found in document` };
            }

            const items = docData.data[subcategory];
            if (!Array.isArray(items)) {
                return { error: `Data in subcategory '${subcategory}' is not an array` };
            }

            // Track unique items using a Map with a composite key
            const uniqueItems = new Map<string, any>();
            const duplicates: string[] = [];

            // First pass: identify unique items and duplicates
            for (const item of items) {
                // Create a composite key based on Title, Location, Date, and EventDate
                const key = `${item.Title || ''}|${item.Location || ''}|${item.Date || ''}|${item.EventDate || ''}`;

                if (!uniqueItems.has(key)) {
                    // This is the first occurrence, keep it
                    uniqueItems.set(key, item);
                } else {
                    // This is a duplicate, mark for removal
                    duplicates.push(item.uid);
                }
            }

            // If no duplicates found, return early
            if (duplicates.length === 0) {
                return {
                    success: true,
                    message: 'No duplicates found',
                    removed: 0,
                };
            }

            // Filter out duplicates
            const filteredItems = items.filter((item) => !duplicates.includes(item.uid));

            // Update the document with the filtered array
            await docRef.update({
                [`data.${subcategory}`]: filteredItems,
            });

            return {
                success: true,
                message: `Successfully removed ${duplicates.length} duplicates from '${subcategory}'`,
                removed: duplicates.length,
            };
        } catch (error) {
            console.error(`Error removing duplicates from Firestore: ${error}`);
            return { error: `Failed to remove duplicates: ${error}` };
        }
    }

    /**
     * Clears the ImageUrl array for all items in all collections
     *
     * @returns {Promise<{success: boolean; message: string; itemsUpdated: number} | ErrorResponse>} - A promise that resolves to a success object with count of updated items or an error response
     */
    async clearAllImageUrls(): Promise<{ success: boolean; message: string; itemsUpdated: number } | ErrorResponse> {
        try {
            // Query to find all documents
            const querySnapshot = await this.db.collectionGroup('data').get();
            let totalUpdatedItems = 0;

            // Iterate through all documents
            for (const doc of querySnapshot.docs) {
                // Get the parent document reference
                const parentRef = doc.ref.parent.parent;
                if (!parentRef) continue;

                // Get the parent document data
                const parentDoc = await parentRef.get();
                const parentData = parentDoc.data();
                if (!parentData || !parentData.data) continue;

                // Check all subcategories in the document
                for (const [subcategory, items] of Object.entries(parentData.data)) {
                    if (!Array.isArray(items)) continue;

                    let updatedItems = false;

                    // Create a new array with cleared ImageUrl fields for all items
                    const updatedItemsArray = items.map((item: any) => {
                        if (item) {
                            // Update all items that have a uid, regardless of current ImageUrl value
                            if (item.uid) {
                                totalUpdatedItems++;
                                updatedItems = true;
                                return {
                                    ...item,
                                    ImageUrl: [],
                                };
                            }
                        }
                        return item;
                    });

                    // Only update if changes were made
                    if (updatedItems) {
                        await parentRef.update({
                            [`data.${subcategory}`]: updatedItemsArray,
                        });
                    }
                }
            }

            if (totalUpdatedItems === 0) {
                return {
                    success: true,
                    message: 'No items found with ImageUrl to clear',
                    itemsUpdated: 0,
                };
            }

            return {
                success: true,
                message: `Successfully cleared ImageUrl for ${totalUpdatedItems} items`,
                itemsUpdated: totalUpdatedItems,
            };
        } catch (error) {
            console.error(`Error clearing all image URLs in Firestore: ${error}`);
            return { error: `Failed to clear all image URLs: ${error}` };
        }
    }

    /**
     * Clears the ImageUrl array for all items in a specific subcategory
     *
     * @param {string} collection - The collection name
     * @param {string} documentName - The document name
     * @param {string} subcategory - The subcategory name
     * @returns {Promise<{success: boolean; message: string; itemsUpdated: number} | ErrorResponse>} - A promise that resolves to a success object with count of updated items or an error response
     */
    async clearAllImagesInSubcategory(
        collection: string,
        documentName: string,
        subcategory: string,
    ): Promise<{ success: boolean; message: string; itemsUpdated: number } | ErrorResponse> {
        try {
            const docRef = await this.db.collection(collection).doc(documentName).get();
            if (!docRef.exists) {
                return { error: `Document ${documentName} not found in collection ${collection}` };
            }

            const data = docRef.data();
            if (!data || !data.data || !data.data[subcategory]) {
                return { error: `Subcategory ${subcategory} not found in document ${documentName}` };
            }

            const items = data.data[subcategory];
            if (!Array.isArray(items)) {
                return { error: `Subcategory ${subcategory} is not an array` };
            }

            let updatedItems = 0;
            const updatedItemsArray = items.map((item: any) => {
                if (item && item.uid) {
                    updatedItems++;
                    return {
                        ...item,
                        ImageUrl: [],
                    };
                }
                return item;
            });

            await this.db
                .collection(collection)
                .doc(documentName)
                .update({
                    [`data.${subcategory}`]: updatedItemsArray,
                });

            return {
                success: true,
                message: `Successfully cleared ImageUrl for ${updatedItems} items in ${collection}/${documentName}/${subcategory}`,
                itemsUpdated: updatedItems,
            };
        } catch (error) {
            console.error(`Error clearing all image URLs in subcategory: ${error}`);
            return { error: `Failed to clear image URLs in subcategory: ${error}` };
        }
    }

    /**
     * Clears the ImageUrl array of an item in a specific collection, document, and subcategory path
     *
     * @param {string} collection - The collection name
     * @param {string} documentName - The document name
     * @param {string} subcategory - The subcategory name
     * @param {string} uid - The unique identifier of the item to clear ImageUrl for
     * @returns {Promise<{success: boolean; message: string} | ErrorResponse>} - A promise that resolves to a success object or an error response
     */
    async clearImageByPath(
        collection: string,
        documentName: string,
        subcategory: string,
        uid: string,
    ): Promise<{ success: boolean; message: string } | ErrorResponse> {
        // Simply call updateImageByPath with an empty array for imageUrl
        return this.updateImageByPath(collection, documentName, subcategory, uid, []);
    }

    /**
     * Updates the ImageUrl array of an item in a specific collection, document, and subcategory path
     *
     * @param {string} collection - The collection name
     * @param {string} documentName - The document name
     * @param {string} subcategory - The subcategory name
     * @param {string} uid - The unique identifier of the item to update
     * @param {string|string[]} imageUrl - The new image URL(s) to set
     * @returns {Promise<{success: boolean; message: string} | ErrorResponse>} - A promise that resolves to a success object or an error response
     */
    async updateImageByPath(
        collection: string,
        documentName: string,
        subcategory: string,
        uid: string,
        imageUrl: string | string[],
    ): Promise<{ success: boolean; message: string } | ErrorResponse> {
        try {
            // Ensure imageUrl is always an array
            const imageUrlArray = Array.isArray(imageUrl) ? imageUrl : [imageUrl];

            // Get the document
            const docRef = await this.db.collection(collection).doc(documentName).get();
            if (!docRef.exists) {
                return { error: `Document ${documentName} not found in collection ${collection}` };
            }

            const data = docRef.data();
            if (!data || !data.data || !data.data[subcategory]) {
                return { error: `Subcategory ${subcategory} not found in document ${documentName}` };
            }

            // Check if the item with the specified uid exists in this subcategory
            const items = data.data[subcategory];
            if (!Array.isArray(items)) {
                return { error: `Subcategory ${subcategory} does not contain an array of items` };
            }

            const itemIndex = items.findIndex((item: any) => item.uid === uid);
            if (itemIndex === -1) {
                return { error: `Item with uid '${uid}' not found in subcategory ${subcategory}` };
            }

            // First, get the current item to preserve all its data
            const currentItem = items[itemIndex];

            // Create a new item that's an exact copy of the current one, but with updated ImageUrl
            const updatedItem = {
                ...currentItem,
                ImageUrl: imageUrlArray,
            };

            // Create a new array with all items, replacing only the one we want to update
            const updatedItems = [...items];
            updatedItems[itemIndex] = updatedItem;

            // Update only the specific subcategory array, preserving all other data
            await this.db
                .collection(collection)
                .doc(documentName)
                .update({
                    [`data.${subcategory}`]: updatedItems,
                });

            return {
                success: true,
                message: `ImageUrl updated successfully for item with uid '${uid}'`,
            };
        } catch (error) {
            console.error(`Error updating image URL by path: ${error}`);
            return { error: `Failed to update image URL by path: ${error}` };
        }
    }
}

export default FirestoreService;
