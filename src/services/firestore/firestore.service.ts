import { db } from '../../config/firebase';
import { Firestore } from 'firebase-admin/firestore';

// Define error response type
type ErrorResponse = {
    error: string;
};

// Define the standard response format
type StandardResponse = {
    uid: string;
    Title: string;
    Location: string;
    Date: string;
    Description: string;
    ImageUrl: string[];
    Link: string;
};

// Define custom response format that extends the standard format
type CustomResponse = StandardResponse & {
    Logo: string;
    Sports: string;
    Score: string;
    EventDate: string;
    EventEndDate: string;
};

// List of document names that require custom fields in the response
const CUSTOM_DOCUMENTS = ['olemisssports.com'];

/**
 * Service for handling Firestore operations
 */
class FirestoreService {
    private db: Firestore;

    /**
     * Constructor for FirestoreService
     */
    constructor() {
        this.db = db;
    }

    /**
     * Fetches all document IDs from a specified Firestore collection.
     *
     * @param {string} collection - The name of the Firestore collection to query.
     * @returns {Promise<string[] | ErrorResponse>} - A promise that resolves to an array of document IDs or an error response
     */
    async fetchFromCollection(collection: string): Promise<string[] | ErrorResponse> {
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
    async fetchDocumentById(collection: string, documentId: string): Promise<any | ErrorResponse> {
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

        if (fromDate && toDate) {
            filteredData = filteredData.filter((item: any) => {
                const typedItem = item as { EventDate?: string; Date?: string };

                // First try to use the Date field (YYYY-MM-DD format)
                if (typedItem.Date) {
                    const itemDate = new Date(typedItem.Date);
                    if (!isNaN(itemDate.getTime())) {
                        // Check if the date is within the range
                        return itemDate >= fromDate && itemDate <= toDate;
                    }
                }

                // Fall back to EventDate if Date is not available or invalid
                if (typedItem.EventDate) {
                    const eventDate = new Date(typedItem.EventDate);
                    if (!isNaN(eventDate.getTime())) {
                        // Check if the event date is within the range
                        return eventDate >= fromDate && eventDate <= toDate;
                    }
                }

                // If neither Date nor EventDate is valid, exclude this item
                return false;
            });
        }

        // Apply count limit if specified
        if (count !== undefined) {
            filteredData = filteredData.slice(0, count);
        }

        // Ensure each item has all required fields before formatting
        const itemsWithRequiredFields = filteredData.map((item, index) => {
            const typedItem = item as Record<string, any>;

            // Generate a UID if one doesn't exist
            if (!typedItem.uid) {
                typedItem.uid = `${subcategory.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`;
            }

            // Ensure Title field exists
            if (!typedItem.Title) {
                typedItem.Title = typedItem.title || typedItem.name || '';
            }

            // Ensure Location field exists
            if (!typedItem.Location) {
                typedItem.Location = typedItem.location || '';
            }

            // Ensure Description field exists
            if (!typedItem.Description) {
                typedItem.Description = typedItem.description || typedItem.summary || '';
            }

            // Ensure ImageUrl field exists and is an array
            if (!typedItem.ImageUrl) {
                typedItem.ImageUrl = typedItem.imageUrl || typedItem.image || typedItem.images || [];
            }

            // Ensure Link field exists
            if (!typedItem.Link) {
                typedItem.Link = typedItem.link || typedItem.url || '';
            }

            return typedItem;
        });

        // Format the filtered data with standardized fields
        const formattedData = itemsWithRequiredFields.map((item: Record<string, any>) => {
            return this.createStandardResponse(item, documentName === 'olemisssports.com');
        });

        // Sort by date in ascending order (latest date on top)
        return formattedData.sort((a: Record<string, any>, b: Record<string, any>) => {
            const dateA = a.Date ? new Date(a.Date) : null;
            const dateB = b.Date ? new Date(b.Date) : null;

            // If both dates are valid, compare them
            if (dateA && dateB && !isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                return dateB.getTime() - dateA.getTime();
            }

            // If one date is invalid, prioritize the valid one
            if (dateA && !isNaN(dateA.getTime())) return -1;
            if (dateB && !isNaN(dateB.getTime())) return 1;

            // If both dates are invalid, maintain original order
            return 0;
        });
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
            Date: item.Date || item.EventDate || '',
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
        return [...items].sort((a, b) => {
            const dateA = a.publishedDate || a.createdAt || a.createdAtFormatted || 0;
            const dateB = b.publishedDate || b.createdAt || b.createdAtFormatted || 0;

            const timeA = dateA && typeof dateA.toMillis === 'function' ? dateA.toMillis() : dateA;
            const timeB = dateB && typeof dateB.toMillis === 'function' ? dateB.toMillis() : dateB;

            // Sort in descending order (newest first)
            return timeB - timeA;
        });
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
        subcategory: string
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
                    removed: 0
                };
            }

            // Filter out duplicates
            const filteredItems = items.filter(item => !duplicates.includes(item.uid));

            // Update the document with the filtered array
            await docRef.update({
                [`data.${subcategory}`]: filteredItems
            });

            return {
                success: true,
                message: `Successfully removed ${duplicates.length} duplicates from '${subcategory}'`,
                removed: duplicates.length
            };
        } catch (error) {
            console.error(`Error removing duplicates from Firestore: ${error}`);
            return { error: `Failed to remove duplicates: ${error}` };
        }
    }
}

export default FirestoreService;
