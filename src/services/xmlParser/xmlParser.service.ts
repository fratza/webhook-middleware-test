export interface ParsedSportsData {
    score: string;
    localStartDateTime: string;
    opponentLogo: string;
    location: string;
    opponent: string;
    title?: string;
    description?: string;
    link?: string;
    guid?: string;
    startDate?: string;
    endDate?: string;
    localEndDateTime?: string;
    teamLogo?: string;
    gameId?: string;
    gamePromoName?: string;
    links?: {
        liveStats?: string;
        boxScore?: string;
        recap?: string;
    };
}

export class XMLParserService {
    /**
     * Parses sports XML data to extract specific fields from all items
     *
     * @param xmlData - Raw XML string data
     * @returns Array of ParsedSportsData objects containing extracted information
     */
    public parseSportsXML(xmlData: string): ParsedSportsData[] {
        try {
            // Extract all items from the XML
            const items = this.extractItems(xmlData);
            
            if (!items || items.length === 0) {
                console.warn('No items found in XML data');
                return [];
            }
            
            // Process each item and extract the required fields
            const parsedItems = items.map(item => this.parseItem(item));
            
            return parsedItems;
        } catch (error) {
            console.error('Error parsing XML:', error);
            throw new Error(`Failed to parse XML data: ${(error as Error).message}`);
        }
    }
    
    /**
     * Parse a single item from the XML data
     * 
     * @param itemXml - XML string for a single item
     * @returns ParsedSportsData object containing extracted information
     */
    private parseItem(itemXml: string): ParsedSportsData {
        // Extract basic information
        const title = this.extractTagContent(itemXml, 'title');
        const description = this.extractTagContent(itemXml, 'description');
        const link = this.extractTagContent(itemXml, 'link');
        const guid = this.extractTagContent(itemXml, 'guid');
        
        // Extract score from description (e.g., "[L] Ole Miss Softball vs Arizona\nL 1-10 (F/5)\n...")
        const scoreRegex = /\n([LW]\s+\d+-\d+(?:\s+\([^)]+\))?)/;
        const scoreMatch = description.match(scoreRegex);
        const score = scoreMatch ? scoreMatch[1].trim() : '';
        
        // Extract dates and times
        const startDate = this.extractTagContent(itemXml, 'ev:startdate');
        const endDate = this.extractTagContent(itemXml, 'ev:enddate');
        const localStartDateTime = this.extractTagContent(itemXml, 's:localstartdate');
        const localEndDateTime = this.extractTagContent(itemXml, 's:localenddate');
        
        // Extract logos
        const teamLogo = this.extractTagContent(itemXml, 's:teamlogo');
        const opponentLogo = this.extractTagContent(itemXml, 's:opponentlogo');
        
        // Extract location and opponent
        const location = this.extractTagContent(itemXml, 'ev:location');
        const opponent = this.extractTagContent(itemXml, 's:opponent');
        
        // Extract game information
        const gameId = this.extractTagContent(itemXml, 's:gameid');
        const gamePromoName = this.extractTagContent(itemXml, 's:gamepromoname');
        
        // Extract links
        const linksXml = this.extractTagContent(itemXml, 's:links');
        const links = {
            liveStats: this.extractTagContent(linksXml, 's:livestats'),
            boxScore: this.extractTagContent(linksXml, 's:boxscore'),
            recap: this.extractTagContent(linksXml, 's:recap')
        };
        
        return {
            title,
            description,
            link,
            guid,
            score,
            startDate,
            endDate,
            localStartDateTime,
            localEndDateTime,
            teamLogo,
            opponentLogo,
            location,
            opponent,
            gameId,
            gamePromoName,
            links
        };
    }

    /**
     * Extract all item elements from the XML data
     * 
     * @param xmlData - Raw XML string data
     * @returns Array of XML strings, each representing an item
     */
    private extractItems(xmlData: string): string[] {
        const items: string[] = [];
        let itemMatch;
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        
        while ((itemMatch = itemRegex.exec(xmlData)) !== null) {
            if (itemMatch[0]) {
                items.push(itemMatch[0]);
            }
        }
        
        return items;
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
