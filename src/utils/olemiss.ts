/**
 * Utility functions specific to OleMiss sports data processing
 */

// Common type for game details
type GameDetails = {
    Score?: string;
    Date?: string;
    Time?: string;
    EventDate?: string;
    DayOfWeek?: string;
};

/**
 * Month name to number mapping
 */
const MONTH_MAP: Record<string, string> = {
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

/**
 * Regular expressions used for extracting data from OleMiss HTML content
 */
const REGEX = {
    // Regular game scores
    SCORE: /data-test-id="s-game-card-standard__header-game-team-score">([^<]+)<\/span>/,
    // Golf scores in title attribute
    GOLF_SCORE: /title="([^"]+)"[^>]*class="s-game-card__postscore-info"[^>]*>([^<]+)<\/span>/,
    // Alternative golf score pattern
    GOLF_SCORE_ALT: /class="s-game-card__postscore-info"[^>]*>([^<]+)<\/span>/,
    // Date patterns
    DATE_RANGE:
        /data-test-id="s-game-card-standard__header-game-date"[^>]*>([^<]*?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^-]*?-[^<]*?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^<]*?)<\/p>/,
    HEADER_DATE: /data-test-id="s-game-card-standard__header-game-date"[^>]*>([\s\S]*?)<\/p>/,
    DATE_DETAILS: /data-test-id="s-game-card-standard__header-game-date-details"[^>]*><span[^>]*>([^<]+)<\/span>/,
    DAY_OF_WEEK: /<span[^>]*class="s-text-paragraph text-theme-muted ml-1"[^>]*>\(([^\)]+)\)<\/span>/,
    TIME: /aria-label="Event Time"[^>]*>[\s\S]*?(?:(\d+\s+(?:[ap]\.m\.|[AP]M))|All Day)<\/span>/,
};

/**
 * Helper function to clean HTML content
 * @param html HTML string to clean
 * @returns Cleaned text with HTML tags removed and spaces normalized
 */
function cleanHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
}

/**
 * Extract game details from HTML content
 * @param htmlContent HTML content to extract from
 * @param sportType Optional sport type to handle special cases
 * @returns Extracted game details
 */
export function extractGameDetails(htmlContent: string, sportType?: string): GameDetails {
    const result: GameDetails = {};
    if (!htmlContent) return result;

    try {
        // Extract all needed information using regex patterns
        const dateRangeMatch = htmlContent.match(REGEX.DATE_RANGE);
        const dateDetailsMatch = htmlContent.match(REGEX.DATE_DETAILS);
        const dayOfWeekMatch = htmlContent.match(REGEX.DAY_OF_WEEK);
        const timeMatch = htmlContent.match(REGEX.TIME);

        // If day of week isn't found, try to extract it manually
        if (
            (!dayOfWeekMatch && htmlContent.includes('(Sun)')) ||
            htmlContent.includes('(Mon)') ||
            htmlContent.includes('(Tue)') ||
            htmlContent.includes('(Wed)') ||
            htmlContent.includes('(Thu)') ||
            htmlContent.includes('(Fri)') ||
            htmlContent.includes('(Sat)')
        ) {
            const simpleDayMatch = htmlContent.match(/\(([A-Za-z]{3})\)/);
            if (simpleDayMatch) result.DayOfWeek = simpleDayMatch[1];
        }

        // Extract date range if available (for multi-day events)
        if (dateRangeMatch) result.Date = cleanHtml(dateRangeMatch[1]);
        if (dateDetailsMatch) result.Date = dateDetailsMatch[1].trim();
        if (dayOfWeekMatch) result.DayOfWeek = dayOfWeekMatch[1].trim();
        if (timeMatch) result.Time = timeMatch[1] ? timeMatch[1].trim() : 'All Day';

        // Format EventDate with the extracted data
        if (result.Date) {
            if (result.DayOfWeek && result.Time) {
                result.EventDate = `${result.Date} (${result.DayOfWeek}) / ${result.Time}`;
            } else if (result.DayOfWeek) {
                result.EventDate = `${result.Date} (${result.DayOfWeek})`;
            } else if (result.Time) {
                result.EventDate = `${result.Date} / ${result.Time}`;
            } else {
                result.EventDate = result.Date;
            }
        }
    } catch (error) {
        console.error(
            '[OleMiss Parser] Error extracting game details:',
            error instanceof Error ? error.message : String(error),
        );
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
        // If we have a Date field, parse it
        if (itemKey === 'Date' && processedItem[itemKey]) {
            const eventDateStr = processedItem[itemKey];
            updateDateFields(eventDateStr, newLabel);
        }
    }
}

/**
 * Get month number from month name
 * @param monthName Month name (e.g., 'Jan', 'February')
 * @returns Two-digit month number as string (e.g., '01' for January)
 */
function getMonthNumber(monthName: string): string {
    return MONTH_MAP[monthName.toLowerCase()] || '01'; // Default to January if not found
}

/**
 * Parse event date string into standardized date format
 * @param eventDateStr Event date string
 * @returns Object containing start and end dates in YYYY-MM-DD format
 */
export function parseEventDate(eventDateStr: string): { startDate: string; endDate: string } | null {
    if (!eventDateStr) return null;

    const cleanedStr = eventDateStr.replace(/\s+/g, ' ').trim();
    const currentYear = new Date().getFullYear();

    // Helper to create date string in YYYY-MM-DD format
    const formatDate = (month: string, day: string, year = currentYear.toString()) => {
        return `${year}-${getMonthNumber(month)}-${day.padStart(2, '0')}`;
    };

    // Try to match date range: "Jun 11(Wed)-Jun 13(Fri)" or "Jun 11 (Wed) - Jun 13 (Fri)"
    const rangeMatch = cleanedStr.match(
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*\([^)]*\))?\s*[-–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*\([^)]*\))?/i,
    );
    if (rangeMatch) {
        return {
            startDate: formatDate(rangeMatch[1], rangeMatch[2]),
            endDate: formatDate(rangeMatch[3], rangeMatch[4]),
        };
    }

    // Try to match "Jan 1-3, 2023" or "Jan 1, 2023"
    const yearMatch = cleanedStr.match(
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:-(\d{1,2}))?,\s*(\d{4})/i,
    );
    if (yearMatch) {
        const startDate = formatDate(yearMatch[1], yearMatch[2], yearMatch[4]);
        // If there's an end day specified (e.g., "Jan 1-3, 2023")
        if (yearMatch[3]) {
            return {
                startDate,
                endDate: formatDate(yearMatch[1], yearMatch[3], yearMatch[4]),
            };
        }
        return { startDate, endDate: startDate };
    }

    // Try to match simple date: "Jan 1" (no year specified, use current year)
    const simpleMatch = cleanedStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
    if (simpleMatch) {
        const date = formatDate(simpleMatch[1], simpleMatch[2]);
        return { startDate: date, endDate: date };
    }

    return null;
}

/**
 * Process OleMiss HTML content
 * @param htmlContent HTML content to process
 * @param sportType Optional sport type to handle special cases
 * @returns Processed data with extracted fields
 */
export function processOleMissHtml(htmlContent: string, sportType?: string): GameDetails {
    return extractGameDetails(htmlContent, sportType);
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
    // Skip processing if DetailSrc is missing or invalid
    if (
        !processedItem?.DetailSrc ||
        typeof processedItem.DetailSrc !== 'string' ||
        !processedItem.DetailSrc.includes('s-game-card-standard__header')
    ) {
        return newLabel;
    }

    try {
        // Get sport type for context
        const sportType = processedItem.Sport || '';

        // Extract all available data with sport type context
        const gameDetails = extractGameDetails(processedItem.DetailSrc, sportType);
        const headerGameDate = extractHeaderGameDate(processedItem.DetailSrc);

        // Update score and time if available
        if (gameDetails.Score) newLabel.Score = gameDetails.Score;
        if (gameDetails.Time) newLabel.Time = gameDetails.Time;

        // Process date information - prioritize header date if available
        const dateSource = headerGameDate || gameDetails.Date;
        if (dateSource) {
            updateDateFields(dateSource, newLabel);
        }

        // Set EventDate if available from gameDetails
        if (gameDetails.EventDate) {
            newLabel.EventDate = gameDetails.EventDate;
        }

        // Transform Logo URL if present to use 200x200 dimensions
        if (newLabel.Logo) {
            newLabel.Logo = transformOleMissLogoUrl(newLabel.Logo);
        }
    } catch (error) {
        console.error('[OleMiss] Error processing item:', error instanceof Error ? error.message : String(error));
    }

    return newLabel;
}

/**
 * Extract date from header-game-date element if present
 * @param detailSrc The DetailSrc HTML content
 * @returns Cleaned date string or null if not found
 */
function extractHeaderGameDate(detailSrc: string): string | null {
    if (!detailSrc) return null;

    try {
        const match = detailSrc.match(REGEX.HEADER_DATE);
        return match ? cleanHtml(match[1]) : null;
    } catch (error) {
        console.error(
            '[OleMiss] Error extracting header date:',
            error instanceof Error ? error.message : String(error),
        );
        return null;
    }
}

/**
 * Update date fields in the label object
 * @param dateString Raw date string to process
 * @param label Label object to update
 */
function updateDateFields(dateString: string, label: any): void {
    // Parse the date for standardized format
    const parsedDate = parseEventDate(dateString);

    // Update with standardized format if parsed successfully
    if (parsedDate) {
        // Set Date to the standardized value
        label.Date = parsedDate.startDate;

        // Add end date if different from start date
        if (parsedDate.endDate !== parsedDate.startDate) {
            label.EventEndDate = parsedDate.endDate;
        }
    } else {
        // If we couldn't parse the date, use the original string
        label.Date = dateString;
    }
}

/**
 * Extract score from DetailSrc based on sport type
 * @param detailSrc The DetailSrc HTML content
 * @param sportType The type of sport (WGOLF, MGOLF, etc.)
 * @returns Extracted score or null if not found
 */
export function extractScore(detailSrc: string, sportType?: string): string | null {
    if (!detailSrc) return null;

    try {
        // Different extraction logic based on sport type
        if (sportType === 'WGOLF' || sportType === 'MGOLF') {
            // For golf, try to extract from title attribute first
            const golfMatch = detailSrc.match(REGEX.GOLF_SCORE);
            if (golfMatch && golfMatch[1]) {
                const extractedScore = golfMatch[1];
                console.log(`[OleMiss] Extracted ${sportType} score from title:`, extractedScore);
                return extractedScore;
            }

            // Try alternative pattern if title attribute not found
            const altMatch = detailSrc.match(REGEX.GOLF_SCORE_ALT);
            if (altMatch && altMatch[1]) {
                const extractedScore = altMatch[1];
                console.log(`[OleMiss] Extracted ${sportType} score from text:`, extractedScore);
                return extractedScore;
            }
        } else {
            // For other sports, use the standard score pattern
            const scoreMatch = detailSrc.match(REGEX.SCORE);
            if (scoreMatch && scoreMatch[1]) {
                const extractedScore = scoreMatch[1];
                console.log(`[OleMiss] Extracted ${sportType || 'standard'} score:`, extractedScore);
                return extractedScore;
            }
        }

        return null;
    } catch (error) {
        console.error('[OleMiss] Error extracting score:', error instanceof Error ? error.message : String(error));
        return null;
    }
}

/**
 * Process sports data specifically for OleMiss sports data
 * @param item The item to process (must be OleMiss data)
 * @returns The item with processed OleMiss sports data
 * @note This function should only be used for OleMiss data as it contains OleMiss-specific extraction logic
 */
export function processSportsItem(item: any): any {
    if (!item || !item.Sports) {
        return item;
    }

    // Process DetailSrc if it exists
    if (item.DetailSrc) {
        // Extract score
        const extractedScore = extractScore(item.DetailSrc, item.Sports);
        if (extractedScore) {
            // Store the extracted score in the Score field
            item.Score = extractedScore;
        }

        // Extract date information
        try {
            // Get game details including date information
            const gameDetails = extractGameDetails(item.DetailSrc, item.Sports);
            const headerGameDate = extractHeaderGameDate(item.DetailSrc);

            // Process date information - prioritize header date if available
            const dateSource = headerGameDate || gameDetails.Date;
            if (dateSource) {
                updateDateFields(dateSource, item);
            }

            // Set EventDate if available from gameDetails
            if (gameDetails.EventDate) {
                item.EventDate = gameDetails.EventDate;
            }

            // Set Time if available
            if (gameDetails.Time) {
                item.Time = gameDetails.Time;
            }
        } catch (error) {
            console.error('[OleMiss] Error processing date information:', error);
        }
    }

    if (item.Logo) {
        item.Logo = transformOleMissLogoUrl(item.Logo);
    }

    return item;
}

/**
 * Transform Ole Miss logo URLs to use 200x200 dimensions
 * @param logoUrl The original logo URL
 * @returns The transformed URL with updated dimensions
 */

export function transformOleMissLogoUrl(logoUrl: string): string {
    if (!logoUrl) return logoUrl;

    try {
        // Check if this is a sidearmdev URL with width and height parameters
        if (logoUrl.includes('sidearmdev.com/crop') && (logoUrl.includes('width=') || logoUrl.includes('height='))) {
            // Replace width and height parameters with 200
            return logoUrl.replace(/width=\d+/g, 'width=200').replace(/height=\d+/g, 'height=200');
        }

        return logoUrl;
    } catch (error) {
        console.error('[OleMiss] Error transforming logo URL:', error instanceof Error ? error.message : String(error));
        return logoUrl;
    }
}
