export interface ParsedSportsData {
    score: string;
    localStartDateTime: string;
    opponentLogo: string;
    location: string;
    opponent: string;
}

export class XMLParserService {
    /**
     * Parses sports XML data to extract specific fields
     *
     * @param xmlData - Raw XML string data
     * @returns ParsedSportsData object containing extracted information
     */
    public parseSportsXML(xmlData: string): ParsedSportsData {
        try {
            // Extract score from description
            const description = this.extractTagContent(xmlData, 'description');
            const scoreRegex = /\n([LW]\s+\d+-\d+(?:\s+\([^)]+\))?)/;
            const scoreMatch = description.match(scoreRegex);
            const score = scoreMatch ? scoreMatch[1].trim() : '';

            // Extract local start date and time
            const localStartDateTime = this.extractTagContent(xmlData, 's:localstartdate');

            // Extract opponent logo
            const opponentLogo = this.extractTagContent(xmlData, 's:opponentlogo');

            // Extract location
            const location = this.extractTagContent(xmlData, 'ev:location');

            // Extract opponent
            const opponent = this.extractTagContent(xmlData, 's:opponent');

            return {
                score,
                localStartDateTime,
                opponentLogo,
                location,
                opponent,
            };
        } catch (error) {
            console.error('Error parsing XML:', error);
            throw new Error(`Failed to parse XML data: ${(error as Error).message}`);
        }
    }

    /**
     * Helper method to extract content from XML tags using regex
     *
     * @param xmlData - Raw XML string data
     * @param tagName - Name of the XML tag to extract content from
     * @returns The content between the opening and closing tags
     */
    private extractTagContent(xmlData: string, tagName: string): string {
        // Create a regex pattern to match the tag content
        // This handles both self-closing tags and tags with content
        const regexPattern = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>|<${tagName}[^>]*\/>`);
        const match = xmlData.match(regexPattern);

        if (match && match[1]) {
            // Return the content between tags
            return match[1].trim();
        } else if (match) {
            // Handle self-closing tags
            const selfClosingMatch = match[0].match(/value=['"](.*?)['"]/) || [];
            return selfClosingMatch[1] || '';
        }

        return '';
    }
}
