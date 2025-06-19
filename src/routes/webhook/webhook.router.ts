import { Router, Request, Response } from 'express';
import logger from '../../middlewares/logger';
import { BrowseAIService } from '../../services/browseAI/browseAI.service';
import { XMLParserService } from '../../services/xmlParser/xmlParser.service';

const WEBHOOK_ROUTER = Router();
const browseAIService = new BrowseAIService();
const xmlParserService = new XMLParserService();

/**
 * Handles incoming POST requests to dynamic webhook endpoints under `/api/webhook/:webhookId`.
 *
 * Currently supports:
 * - `browseAI`: Processes webhook data using the `BrowseAIService`.
 * - `xmlparser`: Parses XML data to extract specific fields.
 *
 * Example usage:
 * - POST to `/api/webhook/browseAI` with JSON payload
 * - POST to `/api/webhook/xmlparser` with XML payload
 *
 * @route POST /api/webhook/:webhookId
 * @param {Request} req - The Express request object containing webhook data and params.
 * @param {Response} res - The Express response object used to send responses.
 * @returns {void} Sends a JSON response indicating success or failure.
 */
WEBHOOK_ROUTER.post('/:webhookId', async (req: Request, res: Response) => {
    const webhookId = req.params.webhookId;

    // BrowseAI Webhook
    if (webhookId.toLowerCase() === 'browseai') {
        try {
            // Only log once with combined information
            console.log(`[Webhook:${webhookId}] Processing request`);

            const result = await browseAIService.processWebhookData(req.body);

            res.json(result);
        } catch (error: any) {
            logger.error('[BrowseAI Webhook] Error:', error);

            // Check if it's a structured error with status code
            if (error && typeof error === 'object' && 'status' in error) {
                const statusCode = error.status || 500;
                return res.status(statusCode).json({
                    success: false,
                    error: error.message || 'Error processing BrowseAI webhook data',
                    details: error.details || 'No additional details available',
                });
            }

            // Handle 400 Bad Request errors specifically
            if (error.message && error.message.includes('400')) {
                return res.status(400).json({
                    success: false,
                    error: 'Bad Request',
                    details: error.message || 'Invalid webhook data format',
                });
            }

            // Default to 500 for other errors
            res.status(500).json({
                success: false,
                error: (error as Error).message || 'Error processing BrowseAI webhook data',
            });
        }
    } else if (webhookId.toLowerCase() === 'xmlparser') {
        try {
            console.log(`[Webhook:${webhookId}] Processing XML request`);
            
            // Get the raw XML data from the request body
            const xmlData = req.body.toString();
            
            if (!xmlData) {
                return res.status(400).json({
                    success: false,
                    error: 'No XML data provided',
                });
            }
            
            // Parse the XML data
            const parsedData = xmlParserService.parseSportsXML(xmlData);
            
            // Return the parsed data
            res.json({
                success: true,
                data: parsedData,
            });
        } catch (error: any) {
            logger.error('[XML Parser Webhook] Error:', error);
            
            res.status(500).json({
                success: false,
                error: (error as Error).message || 'Error processing XML data',
            });
        }
    } else {
        // Handle unknown webhook ID
        res.status(404).json({
            success: false,
            error: `Unknown webhook ID: ${webhookId}`,
        });
    }
});

export default WEBHOOK_ROUTER;
