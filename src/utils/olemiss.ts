/**
 * Utility functions specific to OleMiss sports data processing
 */

// Common type for game details
type GameDetails = {
    Score?: string;
    Date?: string;
    Time?: string;
    EventDate?: string;
};

/**
 * Extracts score, date, and time information from HTML content
 * @param htmlContent The HTML content to parse
 * @returns Object containing extracted score, date, and time
 */
export function extractGameDetails(htmlContent: string): GameDetails {
    const result: GameDetails = {};

    try {
        // Extract Score
        extractWithRegex(
            htmlContent,
            /data-test-id="s-game-card-standard__header-game-team-score">([^<]+)<\/span>/,
            (match) => {
                result.Score = match[1].trim();
            },
        );

        // Extract date range format (Jun 11 - Jun 13)
        extractWithRegex(
            htmlContent,
            /data-test-id="s-game-card-standard__header-game-date"[^>]*>([^<]*?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^-]*?-[^<]*?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^<]*?)<\/p>/,
            (match) => {
                const rawDateStr = match[1]
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                result.EventDate = rawDateStr;
                console.log('[OleMiss Parser] Raw extracted event date string:', rawDateStr);
            },
        );

        // Try original date format as fallback
        extractWithRegex(
            htmlContent,
            /data-test-id="s-game-card-standard__header-game-date-details"[^>]*><span[^>]*>([^<]+)<\/span>/,
            (match) => {
                result.Date = match[1].trim();
                console.log('[OleMiss Parser] Original date format extracted:', result.Date);
            },
        );

        // Extract Time - Handle both specific times and "All Day" format
        extractWithRegex(
            htmlContent,
            /aria-label="Event Time"[^>]*>[\s\S]*?(?:(\d+\s+[ap]\.m\.)|All Day)<\/span>/,
            (match) => {
                result.Time = match[1] ? match[1].trim() : 'All Day';
            },
        );

        console.log('[OleMiss Parser] Final extracted game details:', result);
    } catch (error) {
        console.error('[OleMiss Parser] Error extracting game details:', error);
    }

    return result;
}

/**
 * Helper function to extract data using regex
 * @param content Content to search in
 * @param regex Regular expression to use
 * @param handler Function to handle the match
 */
function extractWithRegex(content: string, regex: RegExp, handler: (match: RegExpMatchArray) => void): void {
    const match = content.match(regex);
    if (match) {
        handler(match);
    }
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
 * Get month number from month name
 * @param monthName Month name (e.g., 'Jan', 'February')
 * @returns Two-digit month number as string (e.g., '01' for January)
 */
function getMonthNumber(monthName: string): string {
    const monthMap: Record<string, string> = {
        jan: '01',
        january: '01',
        feb: '02',
        february: '02',
        mar: '03',
        march: '03',
        apr: '04',
        april: '04',
        may: '05',
        jun: '06',
        june: '06',
        jul: '07',
        july: '07',
        aug: '08',
        august: '08',
        sep: '09',
        september: '09',
        oct: '10',
        october: '10',
        nov: '11',
        november: '11',
        dec: '12',
        december: '12',
    };

    return monthMap[monthName.toLowerCase()] || '01'; // Default to January if not found
}

/**
 * Parse event date string into standardized date format
 * @param eventDateStr Event date string
 * @returns Object containing start and end dates in YYYY-MM-DD format
 */
export function parseEventDate(eventDateStr: string): { startDate: string; endDate: string } | null {
    // Clean up the input string - remove extra spaces and normalize
    const cleanedStr = eventDateStr.replace(/\s+/g, ' ').trim();
    const currentYear = new Date().getFullYear();

    // Format: "Jun 11(Wed)-Jun 13(Fri)" or "Jun 11 (Wed) - Jun 13 (Fri)"
    const formatWithDayRegex =
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*\([^)]*\))?\s*[-–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*\([^)]*\))?/i;
    const formatWithDayMatch = cleanedStr.match(formatWithDayRegex);

    if (formatWithDayMatch) {
        // Extract date components
        const startMonth = getMonthNumber(formatWithDayMatch[1]);
        const startDay = formatWithDayMatch[2].padStart(2, '0');
        const endMonth = getMonthNumber(formatWithDayMatch[3]);
        const endDay = formatWithDayMatch[4].padStart(2, '0');

        const startDate = `${currentYear}-${startMonth}-${startDay}`;
        const endDate = `${currentYear}-${endMonth}-${endDay}`;

        console.log(`[OleMiss] Parsed event date range: ${startDate} to ${endDate} from "${eventDateStr}"`);
        return { startDate, endDate };
    }

    // Format: "Jan 1-3, 2023" or "Jan 1, 2023"
    const match = eventDateStr.match(
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:-(\d{1,2}))?,\s*(\d{4})/,
    );

    if (match) {
        const month = getMonthNumber(match[1]);
        const startDay = match[2].padStart(2, '0');
        const year = match[4];
        const startDate = `${year}-${month}-${startDay}`;

        // If there's an end day specified (e.g., "Jan 1-3, 2023")
        if (match[3]) {
            const endDay = match[3].padStart(2, '0');
            return { startDate, endDate: `${year}-${month}-${endDay}` };
        }

        return { startDate, endDate: startDate };
    }

    // Format: "Jan 1" (no year specified, use current year)
    const simpleMatch = eventDateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/);

    if (simpleMatch) {
        const month = getMonthNumber(simpleMatch[1]);
        const day = simpleMatch[2].padStart(2, '0');
        const date = `${currentYear}-${month}-${day}`;
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
    // Check if we have DetailSrc with the expected content
    if (!hasValidDetailSrc(processedItem)) {
        return newLabel;
    }

    console.log('[OleMiss] Processing DetailSrc HTML content');

    // First check if header-game-date is present in DetailSrc
    const headerGameDate = extractHeaderGameDate(processedItem.DetailSrc);

    if (headerGameDate) {
        // If header-game-date is found, use it directly
        processEventDateField(headerGameDate, newLabel);

        // Still extract other details like Score and Time
        const gameDetails = extractGameDetails(processedItem.DetailSrc);
        processScoreAndTime(gameDetails, newLabel);
    } else {
        // If header-game-date is not found, proceed with the regular extraction
        const gameDetails = extractGameDetails(processedItem.DetailSrc);

        // Process extracted game details
        processScoreAndTime(gameDetails, newLabel);
        processDateInformation(gameDetails, newLabel);
    }

    return newLabel;
}

/**
 * Check if the processed item has valid DetailSrc
 */
function hasValidDetailSrc(processedItem: any): boolean {
    return (
        processedItem.DetailSrc &&
        typeof processedItem.DetailSrc === 'string' &&
        processedItem.DetailSrc.includes('s-game-card-standard__header')
    );
}

/**
 * Check if DetailSrc contains header-game-date and extract it directly if present
 * @param detailSrc The DetailSrc HTML content
 * @returns Extracted EventDate string or null if not found
 */
function extractHeaderGameDate(detailSrc: string): string | null {
    try {
        const headerGameDateRegex = /data-test-id="s-game-card-standard__header-game-date"[^>]*>([\s\S]*?)<\/p>/;
        const match = detailSrc.match(headerGameDateRegex);

        if (match) {
            // Clean up the extracted HTML content
            const rawDateStr = match[1]
                .replace(/<[^>]*>/g, ' ') // Remove HTML tags
                .replace(/\s+/g, ' ') // Normalize spaces
                .trim();

            console.log('[OleMiss] Directly extracted header-game-date:', rawDateStr);
            return rawDateStr;
        }
    } catch (error) {
        console.error('[OleMiss] Error extracting header-game-date:', error);
    }

    return null;
}

/**
 * Process score and time information
 */
function processScoreAndTime(gameDetails: GameDetails, newLabel: any): void {
    if (gameDetails.Score) {
        newLabel.Score = gameDetails.Score;
        console.log('[OleMiss] Extracted Score:', gameDetails.Score);
    }

    if (gameDetails.Time) {
        newLabel.Time = gameDetails.Time;
        console.log('[OleMiss] Extracted Time:', gameDetails.Time);
    }
}

/**
 * Process date information from game details
 */
function processDateInformation(gameDetails: GameDetails, newLabel: any): void {
    // First try to use EventDate if available
    if (gameDetails.EventDate) {
        processEventDateField(gameDetails.EventDate, newLabel);
    }
    // Fallback to Date field if EventDate is not available
    else if (gameDetails.Date) {
        newLabel.EventDate = gameDetails.Date;
        console.log('[OleMiss] Using original Date field for EventDate:', gameDetails.Date);
    }
}

/**
 * Process the EventDate field
 */
function processEventDateField(eventDateStr: string, newLabel: any): void {
    newLabel.EventDate = eventDateStr;
    console.log('[OleMiss] Extracted date range into EventDate:', eventDateStr);

    // Try to parse the date string into standardized format
    const parsedDate = parseEventDate(eventDateStr);
    if (parsedDate) {
        newLabel.EventDate = parsedDate.startDate;
        console.log('[OleMiss] Parsed start date:', parsedDate.startDate);

        // If the end date is different from the start date, include it
        if (parsedDate.endDate !== parsedDate.startDate) {
            newLabel.EventEndDate = parsedDate.endDate;
            console.log('[OleMiss] Parsed end date:', parsedDate.endDate);
        }
    }
}
