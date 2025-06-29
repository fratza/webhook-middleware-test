import * as admin from 'firebase-admin';
import { processOleMissItem } from './olemiss';
import logger from '../middlewares/logger';

/**
 * Appends new data to existing document data
 * @param docSnapshot The document snapshot containing existing data
 * @param processedData The new processed data to append
 * @param originUrl The origin URL
 * @returns The merged data structure
 */
export function appendNewData(
    docSnapshot: admin.firestore.DocumentSnapshot,
    processedData: any,
    originUrl: string,
): any {
    const existingData = docSnapshot.data();
    if (!existingData) {
        console.log(
            `[DB Insert] Creating new document with ${Object.keys(processedData).length} fields from ${originUrl}`,
        );
        return { data: processedData };
    }

    // Create a deep copy of the existing data to work with
    const mergedData = JSON.parse(JSON.stringify(existingData));

    // Ensure base structure exists
    if (!mergedData.data) mergedData.data = {};

    console.log(`[DB Update] Updating document ${docSnapshot.id} with data from ${originUrl}`);

    // Process each key in the processed data
    Object.keys(processedData).forEach((key) => {
        const newValue = processedData[key];

        // Log sports data in the incoming data
        if (Array.isArray(newValue)) {
            newValue.forEach((item, index) => {
                if (item && item.Sports) {
                    console.log(
                        `[Sports Data] In appendNewData - ${key}[${index}] sports data:`,
                        JSON.stringify(item.Sports),
                    );
                }
            });
        }

        // If the key already exists in the existing data and both are arrays
        if (mergedData.data[key] && Array.isArray(mergedData.data[key]) && Array.isArray(newValue)) {
            // Append the new array items to the existing array
            const originalLength = mergedData.data[key].length;
            mergedData.data[key] = [...mergedData.data[key], ...newValue];
            console.log(
                `[DB Update] Appended ${newValue.length} items to existing array '${key}' (was: ${originalLength}, now: ${mergedData.data[key].length})`,
            );

            // Log sports data after merging
            if (key === 'OleSports' || key === 'Events') {
                console.log(`[Sports Data] After merge - ${key} array contains ${mergedData.data[key].length} items`);
                mergedData.data[key].forEach((item: any, index: number) => {
                    if (item && item.Sports) {
                        console.log(`[Sports Data] Merged item ${index} sports data:`, JSON.stringify(item.Sports));
                    }
                });
            }
        } else {
            // Otherwise, replace or add the key-value pair
            const isNew = mergedData.data[key] === undefined;
            mergedData.data[key] = newValue;
            console.log(
                `[DB Update] ${isNew ? 'Added new' : 'Updated'} field '${key}' with ${Array.isArray(newValue) ? `${newValue.length} items` : 'value'}`,
            );
        }
    });

    console.log(
        `[DB Update] Completed update for document ${docSnapshot.id} with ${Object.keys(processedData).length} fields`,
    );
    return mergedData;
}

/**
 * Extract a domain identifier from a URL
 * @param url The URL to extract from
 * @returns The extracted domain identifier
 */
export function extractDomainIdentifier(url: string): string {
    let docName = 'unknown';

    try {
        if (url && url !== 'unknown') {
            const urlObj = new URL(url as string); // Parse the URL
            const parts = urlObj.hostname.split('.'); // Split the hostname

            // Extract the last 2 segments of the domain
            if (parts.length >= 2) {
                const domainParts = parts.slice(-2); // e.g., ['espn', 'com']
                docName = domainParts.join('.');
            } else {
                docName = urlObj.hostname;
            }
        }
    } catch (error) {
        logger.warn(`Invalid URL: ${url}`);
    }

    return docName;
}

/**
 * Clean data by removing unwanted fields at all nesting levels
 * and add optional Image URL field if needed
 * @param data The data to clean
 * @param existingData Optional existing data to check for arrays
 * @param originUrl The origin URL to include in each item
 * @returns Cleaned data with unwanted fields removed and optional fields added
 */
export function cleanDataFields(
    data: any,
    existingData: any = null,
    originUrl: string = 'unknown',
    docName: string = 'unknown',
): any {
    // Handle null, undefined or primitive values
    if (!data || typeof data !== 'object') return data;

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map((item) => cleanDataFields(item, existingData, originUrl, docName));
    }

    // Handle objects
    return processObjectFields(data, existingData, originUrl, docName);
}

/**
 * Process object fields, filtering to only include specific fields and handling arrays
 * @param data Object to process
 * @param existingData Existing data for reference
 * @param originUrl Origin URL
 * @returns Processed object with only the specified fields
 */
export function processObjectFields(data: any, existingData: any, originUrl: string, docName: string): any {
    const cleaned: any = {};
    // const allowedFields = ['EventDate', 'Location', 'Logo', 'Sports', 'Time'];

    // Process object entries
    for (const [key, value] of Object.entries(data)) {
        // Skip position/Position and _STATUS fields
        if (key.toLowerCase() === 'position' || key === '_STATUS') continue;

        if (Array.isArray(value)) {
            cleaned[key] = processArrayField(key, value, existingData, originUrl, docName);
        } else {
            // Recursively clean nested objects
            cleaned[key] = typeof value === 'object' ? cleanDataFields(value, existingData, originUrl, docName) : value;
        }
    }

    return cleaned;
}

/**
 * Process an array field, handling deduplication and merging with existing data
 * @param key Field key
 * @param value Array value
 * @param existingData Existing data
 * @param originUrl Origin URL
 * @param docName Domain identifier
 * @returns Processed array
 */
export function processArrayField(
    key: string,
    value: any[],
    existingData: any,
    originUrl: string,
    docName: string,
): any[] {
    // Check if this array already exists in the existing data
    const existingArray = existingData?.data?.[key];

    // Process the current array items
    const processedItems = value.map((item, index) =>
        processArrayItem(item, key, index, existingData, originUrl, docName),
    );

    const deduplicated = deduplicateItems(processedItems);

    if (deduplicated.length === 0) return [];

    if (Array.isArray(existingArray)) {
        if (areArraysEquivalent(deduplicated, existingArray)) {
            return existingArray;
        }

        const finalItems = deduplicateAgainstExisting(deduplicated, existingArray);

        if (finalItems.length === 0) return existingArray;

        return [...existingArray, ...finalItems];
    }

    return deduplicated;
}

/**
 * Check if two arrays are equivalent (contain the same items)
 * @param array1 First array to compare
 * @param array2 Second array to compare
 * @returns True if arrays contain the same items, false otherwise
 */
export function areArraysEquivalent(array1: any[], array2: any[]): boolean {
    if (!Array.isArray(array1) || !Array.isArray(array2)) return false;
    if (array1.length !== array2.length) return false;

    // Create a map of unique keys for all items in array1
    const array1Keys = new Set(array1.map((item) => createUniqueKeyForItem(item)));

    // Check if all items in array2 have matching keys in array1
    for (const item of array2) {
        const key = createUniqueKeyForItem(item);
        if (!array1Keys.has(key)) return false;
    }

    // All items matched
    return true;
}

/**
 * Process an individual array item
 * @param item Item to process
 * @param key Parent key
 * @param index Item index
 * @param existingData Existing data
 * @param originUrl Origin URL
 * @param docName Domain identifier
 * @returns Processed item
 */
export function processArrayItem(
    item: any,
    key: string,
    index: number,
    existingData: any,
    originUrl: string,
    docName: string,
): any {
    const processedItem = cleanDataFields(item, existingData, originUrl, docName);

    // Generate a unique ID for this item
    const uid = `${key.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`;

    const newLabel: any = {
        uid,
        Title: key,
        originUrl, // Add originUrl to each item
    };

    // Define base allowed fields
    let allowedFields = ['Date', 'ImageUrl', 'Location', 'Logo', 'Time', 'Description', 'Title', 'uid'];

    // Custom Field

    // OLEMISSPORTS.COM
    if (docName === 'olemisssports.com' || originUrl.includes('olemisssports.com')) {
        allowedFields = [...allowedFields, 'Score', 'EventDate', 'EventEndDate', 'Sports', 'DetailSrc'];
    }

    // Add all existing fields from the processed item, but only if they're in the allowed list
    Object.keys(processedItem).forEach((itemKey) => {
        // Only include allowed fields
        if (allowedFields.includes(itemKey)) {
            newLabel[itemKey] = processedItem[itemKey];
        }
    });

    // Special handling for olemisssports.com - apply after copying fields to ensure all data is available
    if (docName === 'olemisssports.com' || originUrl.includes('olemisssports.com')) {
        // Use the dedicated OleMiss processing function
        processOleMissItem(processedItem, newLabel, docName, originUrl);
    }

    // If date is not in YYYY-MM-DD format, parse it
    if (newLabel.Date && typeof newLabel.Date === 'string') {
        const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(newLabel.Date);
        if (!isValidFormat) {
            newLabel.Date = parseDateString(newLabel.Date);
        }
    }

    // Add Image URL field and set it to empty string
    if (!('ImageUrl' in newLabel) && !('ImageUrl' in item)) {
        newLabel['ImageUrl'] = '';
    }

    return newLabel;
}

/**
 * Create a unique key for an item based on important fields
 * @param item Item to create key for
 * @returns Unique key string
 */
export function createUniqueKeyForItem(item: any): string {
    if (!item || typeof item !== 'object') {
        return String(item);
    }

    let keyFields = [];

    const isOleMiss = item.originUrl && item.originUrl.includes('olemisssports.com');

    if (isOleMiss) {
        keyFields = ['Title', 'EventDate', 'Location', 'Sports'].filter((field) => item[field]);
    } else {
        keyFields = ['Title', 'Location', 'Date', 'Time'].filter((field) => item[field]);
    }

    // If we couldn't find any key fields, use all available fields
    if (keyFields.length === 0) {
        keyFields = Object.keys(item).filter(
            (key) => typeof item[key] !== 'object' && key !== 'uid' && item[key] !== undefined && item[key] !== null,
        );
    }

    // Create a unique key by combining the values of all key fields
    const keyString = keyFields.map((field) => `${field}:${item[field]}`).join('|');

    return keyString;
}

/**
 * Deduplicate items within a single array based on key fields
 * @param items Array of items to deduplicate
 * @returns Deduplicated array
 */
export function deduplicateItems(items: any[]): any[] {
    if (!Array.isArray(items) || items.length <= 1) return items;

    // Filter out items with null titles first
    const filteredItems = items.filter((item) => {
        // Skip items where Title is null or undefined
        if ((item && item.Title === null) || item.Title === undefined) {
            console.log('[BrowseAI Webhook] Skipping item with null or undefined Title');
            return false;
        }
        return true;
    });

    // If all items were filtered out, return empty array
    if (filteredItems.length === 0) return [];

    // Create a map to track unique items
    const uniqueMap = new Map<string, boolean>();
    const result: any[] = [];

    for (const item of filteredItems) {
        const uniqueKey = createUniqueKeyForItem(item);

        // If we haven't seen this unique key before, add it to the result
        if (!uniqueMap.has(uniqueKey)) {
            uniqueMap.set(uniqueKey, true);
            result.push(item);
        }
    }

    return result;
}

/**
 * Deduplicate new items against existing items
 * @param newItems New items to check
 * @param existingItems Existing items to check against
 * @returns Deduplicated new items
 */
export function deduplicateAgainstExisting(newItems: any[], existingItems: any[]): any[] {
    if (
        !Array.isArray(newItems) ||
        newItems.length === 0 ||
        !Array.isArray(existingItems) ||
        existingItems.length === 0
    ) {
        return newItems;
    }

    // Create a map of existing items
    const existingMap = new Map<string, boolean>();

    for (const item of existingItems) {
        const uniqueKey = createUniqueKeyForItem(item);
        existingMap.set(uniqueKey, true);
    }

    // Filter out new items that already exist
    return newItems.filter((item) => {
        const uniqueKey = createUniqueKeyForItem(item);
        return !existingMap.has(uniqueKey);
    });
}

/**
 * Parse date strings in formats like "MAY SAT 24" into YYYY-MM-DD format
 * @param dateString The date string to parse
 * @returns Formatted date string in YYYY-MM-DD format or the original string if parsing fails
 */
export function parseDateString(dateString: string): string {
    if (!dateString) return '';

    try {
        // Convert to uppercase for consistent handling
        const upperDateStr = dateString.toUpperCase().trim();

        // Regular expression to match month and day, ignoring day of week
        // Matches patterns like "MAY SAT 24", "MAY 24", "MAY24", etc.
        const regex =
            /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:\s+(?:MON|TUE|WED|THU|FRI|SAT|SUN))?\s*(\d{1,2})/;

        const match = upperDateStr.match(regex);
        if (!match) return dateString;

        const monthStr = match[1];
        const day = match[2].padStart(2, '0'); // Pad single digit days with leading zero

        // Map month abbreviations to month numbers
        const monthMap: Record<string, string> = {
            JAN: '01',
            FEB: '02',
            MAR: '03',
            APR: '04',
            MAY: '05',
            JUN: '06',
            JUL: '07',
            AUG: '08',
            SEP: '09',
            OCT: '10',
            NOV: '11',
            DEC: '12',
        };

        const month = monthMap[monthStr];
        if (!month) return dateString;

        // Use current year (2025) as specified
        const year = '2025';

        // Return formatted date
        return `${year}-${month}-${day}`;
    } catch (error) {
        logger.error(`Error parsing date string: ${dateString}`, error);
        return dateString; // Return original string if parsing fails
    }
}
