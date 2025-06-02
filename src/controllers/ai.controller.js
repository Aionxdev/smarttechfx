// src/controllers/ai.controller.js
import { aiService } from '../services/index.js'; // Ensure aiService is exported from services/index.js
import { sendSuccessResponse } from '../utils/apiResponse.util.js';
import { HTTP_STATUS_CODES } from '../constants/index.js';
import ApiError, { BadRequestError } from '../utils/apiError.util.js';
import logger from '../utils/logger.util.js';

/**
 * Handles a user's message to the AI, gets a response, and sends it back.
 */
export const sendMessageToAI = async (req, res) => {
    const userId = req.user.userId; // Populated by verifyJWT middleware
    const { message, chatHistory } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === "") {
        throw new BadRequestError("Message content is required and cannot be empty.");
    }

    // Validate chatHistory structure if provided
    if (chatHistory) {
        if (!Array.isArray(chatHistory)) {
            throw new BadRequestError("chatHistory must be an array if provided.");
        }
        for (const item of chatHistory) {
            if (!item || typeof item.role !== 'string' || typeof item.text !== 'string' ||
                !['user', 'AI', 'model'].includes(item.role.toLowerCase())) { // Allow 'user', 'AI', or 'model' as roles
                throw new BadRequestError("Each item in chatHistory must have a valid 'role' (user/AI/model) and 'text'.");
            }
        }
    }

    try {
        const aiResponseText = await aiService.getAIResponse(userId, chatHistory || [], message.trim());

        return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, {
            aiMessage: {
                role: 'AI', // The role the frontend should assign to this message
                text: aiResponseText,
                timestamp: new Date().toISOString() // Add a timestamp for the AI's response
            }
        }, "AI response received successfully.");

    } catch (error) {
        // aiService.getAIResponse might throw ServiceUnavailableError or other ApiErrors
        logger.error(`[AI Controller] Error in sendMessageToAI for user ${userId}:`, error);
        if (error instanceof ApiError) {
            throw error; // Re-throw known API errors to be handled by global error handler
        }
        // For unexpected errors from the service or Gemini interaction
        throw new ApiError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, "An unexpected error occurred while communicating with the AI assistant.");
    }
};

/**
 * Handles a user's request to escalate the current AI chat to human support.
 */
export const escalateToHumanSupport = async (req, res) => {
    const userId = req.user.userId; // Populated by verifyJWT middleware
    const { chatHistorySnapshot, userComment } = req.body;

    if (!chatHistorySnapshot || !Array.isArray(chatHistorySnapshot) || chatHistorySnapshot.length === 0) {
        throw new BadRequestError("chatHistorySnapshot is required and must be a non-empty array to escalate.");
    }

    // Validate chatHistorySnapshot items
    for (const item of chatHistorySnapshot) {
        if (!item || typeof item.role !== 'string' || typeof item.text !== 'string' ||
            !['user', 'AI', 'model'].includes(item.role.toLowerCase())) {
            throw new BadRequestError("Each item in chatHistorySnapshot must have a valid 'role' (user/AI/model) and 'text'.");
        }
    }

    try {
        const escalationSuccess = await aiService.escalateChatToHuman(userId, chatHistorySnapshot, userComment);

        if (!escalationSuccess) {
            // This implies aiService.escalateChatToHuman logged an error but didn't throw,
            // perhaps due to a non-critical DB save issue for the escalation record.
            // We should inform the user that the escalation might not have been fully processed.
            logger.warn(`[AI Controller] Escalation for user ${userId} reported as not successful by service, but no error thrown.`);
            throw new ApiError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, "Could not fully process your escalation request at this time. Please try again or contact support directly if the issue persists.");
        }

        logger.info(`[AI Controller] Chat escalation successfully initiated by user ${userId}. Comment: ${userComment || 'N/A'}`);
        return sendSuccessResponse(res, HTTP_STATUS_CODES.OK,
            { messageDetails: "Escalation request received. Our support team will review your chat history." },
            "Your chat has been flagged for human support review."
        );

    } catch (error) {
        logger.error(`[AI Controller] Error in escalateToHumanSupport for user ${userId}:`, error);
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, "An unexpected error occurred while escalating your chat.");
    }
};