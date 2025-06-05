import { Router, Request, Response } from 'express';
import logger from '../../middlewares/logger';
import { BrowseAIService } from '../../services/browseAI/browseAI.service';

const WEBHOOK_ROUTER = Router();
const browseAIService = new BrowseAIService();

/**
 * Handles incoming POST requests to dynamic webhook endpoints under `/api/webhook/:webhookId`.
 *
 * Currently supports:
 * - `browseAI`: Processes webhook data using the `BrowseAIService`.
 *
 * Example usage:
 * - POST to `/api/webhook/browseAI` with JSON payload
 *
 * @route POST /api/webhook/:webhookId
 * @param {Request} req - The Express request object containing webhook data and params.
 * @param {Response} res - The Express response object used to send responses.
 * @returns {void} Sends a JSON response indicating success or failure.
 */
WEBHOOK_ROUTER.post('/:webhookId', async (req: Request, res: Response) => {
    const webhookId = req.params.webhookId;
    console.log('[Webhook] Incoming request at URL:', webhookId);

    // BrowseAI Webhook
    if (webhookId.toLowerCase() === 'browseai') {
        try {
            logger.info('[BrowseAI Webhook] Received request');

            const result = await browseAIService.processWebhookData(req.body);

            res.json(result);
        } catch (error) {
            logger.error('[BrowseAI Webhook] Error:', error);

            res.status(500).json({
                success: false,
                error: (error as Error).message || 'Error processing BrowseAI webhook data',
            });
        }
    }
});

export default WEBHOOK_ROUTER;
