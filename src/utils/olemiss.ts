/**
 * Utility functions specific to OleMiss sports data processing
 */

/**
 * Extracts score, date, and time information from HTML content
 * @param htmlContent The HTML content to parse
 * @returns Object containing extracted score, date, and time
 */
export function extractGameDetails(htmlContent: string): { Score?: string; Date?: string; Time?: string } {
    const result: { Score?: string; Date?: string; Time?: string } = {};

    try {
        // Extract Score
        const scoreRegex = /data-test-id="s-game-card-standard__header-game-team-score">([^<]+)<\/span>/;
        const scoreMatch = htmlContent.match(scoreRegex);
        if (scoreMatch && scoreMatch[1]) {
            result.Score = scoreMatch[1].trim();
        }

        // Extract Date
        const dateRegex =
            /data-test-id="s-game-card-standard__header-game-date-details"[^>]*><span[^>]*>([^<]+)<\/span>/;
        const dateMatch = htmlContent.match(dateRegex);
        if (dateMatch && dateMatch[1]) {
            result.Date = dateMatch[1].trim();
        }

        // Extract Time
        // Using a more compatible regex without the 's' flag
        const timeRegex = /aria-label="Event Time"[^>]*>[\s\S]*?(\d+\s+[ap]\.m\.)<\/span>/;
        const timeMatch = htmlContent.match(timeRegex);
        if (timeMatch && timeMatch[1]) {
            result.Time = timeMatch[1].trim();
        }

        console.log('[OleMiss Parser] Extracted game details:', result);
    } catch (error) {
        console.error('[OleMiss Parser] Error extracting game details:', error);
    }

    return result;
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
    // Check if this is an OleMiss sports item
    if (docName === 'olemisssports.com' || originUrl.includes('olemisssports.com')) {
        // If we have an EventDate field, parse it
        if (itemKey === 'EventDate' && processedItem[itemKey]) {
            const eventDateStr = processedItem[itemKey];
            const parsedDate = parseEventDate(eventDateStr);

            if (parsedDate) {
                newLabel['EventDate'] = parsedDate.startDate;

                // If the end date is different from the start date, include it
                if (parsedDate.endDate !== parsedDate.startDate) {
                    newLabel['EventEndDate'] = parsedDate.endDate;
                }
            } else {
                // If we couldn't parse it, just use the original value
                newLabel['EventDate'] = eventDateStr;
            }
        }
    }
}

/**
 * Parse event date string into standardized date format
 * @param eventDateStr Event date string
 * @returns Object containing start and end dates in YYYY-MM-DD format
 */
export function parseEventDate(eventDateStr: string): { startDate: string; endDate: string } | null {
    // Clean up the input string - remove extra spaces and normalize
    const cleanedStr = eventDateStr.replace(/\s+/g, ' ').trim();

    // Format: "Jun 11(Wed)-Jun 13(Fri)" or "Jun 11 (Wed) - Jun 13 (Fri)"
    const formatWithDayRegex =
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*\([^)]*\))?\s*[-–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*\([^)]*\))?/i;
    const formatWithDayMatch = cleanedStr.match(formatWithDayRegex);

    if (formatWithDayMatch) {
        // Month mapping
        const monthMap: { [key: string]: string } = {
            jan: '01',
            feb: '02',
            mar: '03',
            apr: '04',
            may: '05',
            jun: '06',
            jul: '07',
            aug: '08',
            sep: '09',
            oct: '10',
            nov: '11',
            dec: '12',
        };

        // Extract start date components
        const startMonth = formatWithDayMatch[1].toLowerCase();
        const startDay = formatWithDayMatch[2].padStart(2, '0');

        // Extract end date components
        const endMonth = formatWithDayMatch[3].toLowerCase();
        const endDay = formatWithDayMatch[4].padStart(2, '0');

        const currentYear = new Date().getFullYear();

        const startDate = `${currentYear}-${monthMap[startMonth]}-${startDay}`;
        const endDate = `${currentYear}-${monthMap[endMonth]}-${endDay}`;

        console.log(`[OleMiss] Parsed event date range: ${startDate} to ${endDate} from "${eventDateStr}"`);
        return { startDate, endDate };
    }

    // Handle common date formats for OleMiss sports events

    // Format: "Jan 1-3, 2023" or "Jan 1, 2023"
    const match = eventDateStr.match(
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:-(\d{1,2}))?,\s*(\d{4})/,
    );

    if (match) {
        const month = match[1];
        const startDay = match[2].padStart(2, '0');
        const year = match[4];

        // Map month names to numbers
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

        const startDate = `${year}-${monthMap[month]}-${startDay}`;
        let endDate = startDate; // Default end date is same as start date

        // If there's an end day specified (e.g., "Jan 1-3, 2023")
        if (match[3]) {
            const endDay = match[3].padStart(2, '0');
            endDate = `${year}-${monthMap[month]}-${endDay}`;
        }

        return { startDate, endDate };
    }

    // Format: "Jan 1" (no year specified, use current year)
    const simpleMatch = eventDateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/);

    if (simpleMatch) {
        const month = simpleMatch[1];
        const day = simpleMatch[2].padStart(2, '0');
        const currentYear = new Date().getFullYear();

        // Map month names to numbers
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

        const date = `${currentYear}-${monthMap[month]}-${day}`;
        return { startDate: date, endDate: date };
    }

    return null;
}

/**
 * Process OleMiss HTML content
 * @param htmlContent HTML content to process
 * @returns Processed data with extracted fields
 */
export function processOleMissHtml(htmlContent: string): any {
    return extractGameDetails(htmlContent);
}

/**
 * Process OleMiss-specific data in an item
 * @param processedItem The processed item
 * @param newLabel The label object to update
 * @param key Parent key
 * @param docName Domain identifier
 * @param originUrl Origin URL
 * @returns Updated newLabel with OleMiss-specific processing
 */
export function processOleMissItem(
    processedItem: any,
    newLabel: any,
    key: string,
    docName: string,
    originUrl: string,
): any {
    // Check if EventDate exists and contains a month name
    const monthRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;

    if (processedItem.EventDate && monthRegex.test(processedItem.EventDate)) {
        // If EventDate contains a month, process it as a date range
        console.log('[OleMiss] EventDate contains month, processing as date range:', processedItem.EventDate);
        processEventDate(newLabel, 'EventDate', processedItem, key, docName, originUrl);
    } else {
        // If EventDate doesn't exist or doesn't contain a month, parse DetailSrc
        if (
            processedItem.DetailSrc &&
            typeof processedItem.DetailSrc === 'string' &&
            processedItem.DetailSrc.includes('s-game-card-standard__header')
        ) {
            console.log('[OleMiss] Processing DetailSrc HTML content');
            const gameDetails = extractGameDetails(processedItem.DetailSrc);

            // Add extracted details to their corresponding fields in the newLabel object
            if (gameDetails.Score) {
                newLabel.Score = gameDetails.Score;
                console.log('[OleMiss] Extracted Score:', gameDetails.Score);
            }

            if (gameDetails.Date) {
                newLabel.Date = gameDetails.Date;
                console.log('[OleMiss] Extracted Date:', gameDetails.Date);
            }

            if (gameDetails.Time) {
                newLabel.Time = gameDetails.Time;
                console.log('[OleMiss] Extracted Time:', gameDetails.Time);
            }
        } else if (processedItem.EventDate) {
            // If EventDate exists but doesn't have a month and DetailSrc doesn't exist or isn't valid HTML
            // Just pass through the original EventDate value
            newLabel.EventDate = processedItem.EventDate;
            console.log('[OleMiss] Using original EventDate value:', processedItem.EventDate);
        }
    }

    return newLabel;
}
