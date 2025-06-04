import * as admin from 'firebase-admin';

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

        // If the key already exists in the existing data and both are arrays
        if (mergedData.data[key] && Array.isArray(mergedData.data[key]) && Array.isArray(newValue)) {
            // Append the new array items to the existing array
            const originalLength = mergedData.data[key].length;
            mergedData.data[key] = [...mergedData.data[key], ...newValue];
            console.log(
                `[DB Update] Appended ${newValue.length} items to existing array '${key}' (was: ${originalLength}, now: ${mergedData.data[key].length})`,
            );
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
        console.warn(`Invalid URL: ${url}`);
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

    // Deduplicate items before adding them
    const deduplicated = deduplicateItems(processedItems);

    // If the array already exists, append to it; otherwise create a new one
    if (existingArray && Array.isArray(existingArray)) {
        // Deduplicate against existing items
        const finalItems = deduplicateAgainstExisting(deduplicated, existingArray);

        logFilteringResults(deduplicated, finalItems);

        return [...existingArray, ...finalItems];
    }

    return deduplicated;
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
    const processedItem = cleanDataFields(item, existingData, originUrl);

    // Generate a unique ID for this item
    const uid = `${key.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`;

    const newLabel: any = {
        uid,
        Title: key,
        originUrl, // Add originUrl to each item
    };

    // Add all existing fields from the processed item
    Object.keys(processedItem).forEach((itemKey) => {
        newLabel[itemKey] = processedItem[itemKey];

        // Add Image URL if it's missing
        if (!('ImageUrl' in processedItem)) newLabel['ImageUrl'] = '';

        // Special handling for olemisssports.com EventDate field
        processEventDate(newLabel, itemKey, processedItem, key, docName, originUrl);
    });

    return newLabel;
}

/**
 * Process event date for olemisssports.com
 * @param newLabel Label object to update
 * @param itemKey Current item key
 * @param processedItem Processed item
 * @param key Parent key
 * @param docName Domain identifier
 * @param originUrl Origin URL
 */
export function processEventDate(
    newLabel: any,
    itemKey: string,
    processedItem: any,
    key: string,
    docName: string,
    originUrl: string,
): void {
    const isOleMissSite =
        docName === 'olemisssports.com' ||
        originUrl.includes('olemisssports.com') ||
        key === 'Ole Sport' ||
        newLabel.Title === 'Ole Sport';

    if (isOleMissSite && itemKey === 'EventDate' && processedItem[itemKey]) {
        try {
            const eventDateStr = processedItem[itemKey];
            const dateInfo = parseEventDate(eventDateStr);

            if (dateInfo) {
                newLabel['StartDate'] = dateInfo.startDate;
                newLabel['EndDate'] = dateInfo.endDate;

                console.log(`[BrowseAI Webhook] Processed date range: ${dateInfo.startDate} to ${dateInfo.endDate}`);
            }
        } catch (error) {
            console.error(`[BrowseAI Webhook] Error processing date for olemisssports.com:`, error);
        }
    }
}

/**
 * Parse event date string into standardized date format
 * @param eventDateStr Event date string
 * @returns Object containing start and end dates in YYYY-MM-DD format
 */
export function parseEventDate(eventDateStr: string): { startDate: string; endDate: string } | null {
    // Parse dates like "Jun 13\n(Fri)\n-\nJun 23\n(Mon)" or "May 28 (Wed) - May 31 (Sat)"
    const datePattern =
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*\([^\)]*\))?(?:\s*[-\n]+\s*)?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})?/;
    const match = eventDateStr.match(datePattern);

    if (!match) return null;

    // Month mapping
    const monthMap: { [key: string]: string } = {
        Jan: '01',
        Feb: '02',
        Mar: '03',
        Apr: '04',
        May: '05',
        Jun: '06',
        Jul: '07',
        Aug: '08',
        Sep: '09',
        Oct: '10',
        Nov: '11',
        Dec: '12',
    };

    // Extract start date components
    const startMonth = match[1];
    const startDay = match[2].padStart(2, '0');
    const currentYear = new Date().getFullYear();

    const startDate = `${currentYear}-${monthMap[startMonth]}-${startDay}`;
    let endDate = startDate; // Default end date is same as start date

    // If there's an end date
    if (match[3]) {
        // The end date is in format "Month Day"
        const endDateParts = match[3].match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/);
        if (endDateParts) {
            const endMonth = endDateParts[1];
            const endDay = endDateParts[2].padStart(2, '0');
            endDate = `${currentYear}-${monthMap[endMonth]}-${endDay}`;
        }
    }

    return { startDate, endDate };
}

/**
 * Create a unique key for an item based on important fields
 * @param item Item to create key for
 * @returns Unique key string
 */
export function createUniqueKeyForItem(item: any): string {
    // For olemisssports.com, we consider Title, EventDate, Location, and Sports as key fields
    const keyFields = ['Title', 'EventDate', 'Location', 'Sports'].filter((field) => item[field]);

    return keyFields.map((field) => `${field}:${item[field]}`).join('|');
}

/**
 * Deduplicate items within a single array based on key fields
 * @param items Array of items to deduplicate
 * @returns Deduplicated array
 */
export function deduplicateItems(items: any[]): any[] {
    if (!Array.isArray(items) || items.length <= 1) return items;

    // Create a map to track unique items
    const uniqueMap = new Map<string, boolean>();
    const result: any[] = [];

    for (const item of items) {
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
 * Log filtering results
 * @param before Items before filtering
 * @param after Items after filtering
 */
export function logFilteringResults(before: any[], after: any[]): void {
    if (before.length !== after.length) {
        console.log(
            `[BrowseAI Webhook] Filtered out ${before.length - after.length} duplicate items from ${before.length} total items`,
        );
    }
}
