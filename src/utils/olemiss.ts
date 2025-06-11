/**
 * Utility functions specific to OleMiss sports data processing
 */

/**
 * Formats a date string to the format "Jun 11(Wed)-Jun 13(Fri)"
 * @param dateStr The date string to format
 * @param durationDays Optional number of days for the event duration (default: 2)
 * @returns Formatted date string
 */
export function formatEventDate(dateStr: string, durationDays: number = 2): string {
    try {
        // Clean up the input string
        const cleanedStr = dateStr.trim();

        // Check if the string already contains a date range with the format we want
        const rangeRegex =
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\([A-Za-z]{3}\)-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\([A-Za-z]{3}\)/;
        if (rangeRegex.test(cleanedStr)) {
            console.log('[OleMiss Parser] Date already in correct format:', cleanedStr);
            return cleanedStr; // Return as-is if already in correct format
        }

        // Parse the date string to a Date object
        const date = new Date(cleanedStr);

        // Check if the date is valid
        if (isNaN(date.getTime())) {
            console.error('[OleMiss Parser] Invalid date string:', dateStr);
            return dateStr; // Return original if parsing fails
        }

        // Get the month abbreviation
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];

        // Get the day of the month
        const day = date.getDate();

        // Get the day of the week abbreviation
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayOfWeek = days[date.getDay()];

        // Format the start date as "Jun 11(Wed)"
        const startDateFormatted = `${month} ${day}(${dayOfWeek})`;

        // Create an end date based on the provided duration
        const endDate = new Date(date);
        endDate.setDate(date.getDate() + durationDays); // Add specified days for the event duration

        const endMonth = months[endDate.getMonth()];
        const endDay = endDate.getDate();
        const endDayOfWeek = days[endDate.getDay()];

        // Format the end date
        const endDateFormatted = `${endMonth} ${endDay}(${endDayOfWeek})`;

        // Combine into the format "Jun 11(Wed)-Jun 13(Fri)"
        const formattedDateRange = `${startDateFormatted}-${endDateFormatted}`;

        console.log(`[OleMiss Parser] Formatted date range: ${formattedDateRange} from original: ${dateStr}`);
        return formattedDateRange;
    } catch (error) {
        console.error('[OleMiss Parser] Error formatting date:', error);
        return dateStr; // Return original if formatting fails
    }
}

/**
 * Extracts score, date, and time information from HTML content
 * @param htmlContent The HTML content to parse
 * @returns Object containing extracted score, date, and time or EventDate
 */
export function extractGameDetails(htmlContent: string): {
    Score?: string;
    Date?: string;
    Time?: string;
    EventDate?: string;
} {
    const result: { Score?: string; Date?: string; Time?: string; EventDate?: string } = {};

    try {
        // Validation: First check if header game date is present
        const headerGameDateRegex = /data-test-id="s-game-card-standard__header-game-date"/;
        const headerGameDateExists = headerGameDateRegex.test(htmlContent);

        if (headerGameDateExists) {
            console.log('[OleMiss Parser] Header game date found, extracting date for EventDate field');
            // Extract the date from the game date section and place it in EventDate field
            const eventDateRegex =
                /data-test-id="s-game-card-standard__header-game-date"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/;
            const eventDateMatch = htmlContent.match(eventDateRegex);
            if (eventDateMatch && eventDateMatch[1]) {
                const extractedDate = eventDateMatch[1].trim();
                console.log('[OleMiss Parser] Successfully extracted date:', extractedDate);

                // Try to determine if this is a tournament or multi-day event
                // Look for keywords that might indicate a multi-day event
                const isMultiDayEvent = /tournament|championship|invitational|classic|open/i.test(htmlContent);

                // Format the date in the required format with appropriate duration
                // Use 2 days for regular events, 3 days for tournaments/championships
                const duration = isMultiDayEvent ? 3 : 2;
                const formattedDate = formatEventDate(extractedDate, duration);
                result.EventDate = formattedDate;
                console.log('[OleMiss Parser] Extracted and formatted EventDate:', result.EventDate);
            } else {
                console.log('[OleMiss Parser] Header game date element found but failed to extract date text');
            }
        } else {
            console.log('[OleMiss Parser] No header game date found, proceeding with HTML parsing');
            // If header game date is not present, proceed with HTML parsing

            // Extract Score
            const scoreRegex = /data-test-id="s-game-card-standard__header-game-score">([^<]+)<\/span>/;
            const scoreMatch = htmlContent.match(scoreRegex);
            if (scoreMatch && scoreMatch[1]) {
                result.Score = scoreMatch[1].trim();
                console.log('[OleMiss Parser] Extracted Score:', result.Score);
            }

            // Extract Date
            const dateRegex =
                /data-test-id="s-game-card-standard__header-game-date-details"[^>]*><span[^>]*>([^<]+)<\/span>/;
            const dateMatch = htmlContent.match(dateRegex);
            if (dateMatch && dateMatch[1]) {
                const extractedDate = dateMatch[1].trim();
                console.log('[OleMiss Parser] Extracted Date from HTML:', extractedDate);

                // Format the extracted date and put it into EventDate field
                const formattedDate = formatEventDate(extractedDate);
                result.EventDate = formattedDate;
                console.log('[OleMiss Parser] Set formatted date to EventDate:', result.EventDate);

                // Also keep the original date in the Date field for reference
                result.Date = extractedDate;
            } else {
                console.log('[OleMiss Parser] No date found in HTML');
            }

            // Extract Time
            const timeRegex = /aria-label="Event Time"[^>]*>[\s\S]*?(\d+\s+[ap]\.m\.)<\/span>/;
            const timeMatch = htmlContent.match(timeRegex);
            if (timeMatch && timeMatch[1]) {
                result.Time = timeMatch[1].trim();
                console.log('[OleMiss Parser] Extracted Time:', result.Time);
            }
        }

        console.log('[OleMiss Parser] Final extracted game details:', result);
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
            if (gameDetails.EventDate) {
                newLabel.EventDate = gameDetails.EventDate;
                console.log('[OleMiss] Extracted EventDate:', gameDetails.EventDate);
            } else {
                // If no EventDate was found, use the Score, Date, and Time fields
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
