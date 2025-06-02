// src/controllers/analytics.controller.js (Backend)
import { analyticsService } from '../services/index.js'; // Backend analytics service
import { sendSuccessResponse } from '../utils/apiResponse.util.js';
import { HTTP_STATUS_CODES } from '../constants/index.js';
import logger from '../utils/logger.util.js';
import ApiError from '../utils/apiError.util.js';

export const getUserPortfolioHistoryController = async (req, res) => {
    const userId = req.user._id; // Assuming verifyJWT middleware populates req.user
    const periodDays = parseInt(req.query.days, 10) || 30; // Default to 30 days

    logger.info(`[Analytics Controller] Request for portfolio history for user: ${userId}, period: ${periodDays} days`);

    const portfolioData = await analyticsService.getUserInvestmentPortfolioValueHistory(userId, periodDays);
    // The service function getUserInvestmentPortfolioValueHistory should return { currentValueUSD, chartData: { labels, values } }

    return sendSuccessResponse(
        res,
        HTTP_STATUS_CODES.OK,
        portfolioData,
        "User portfolio history fetched successfully."
    );
};


export const getUserDashboardSummaryController = async (req, res) => {
    const userId = req.user._id;
    logger.info(`[Analytics Controller] Request for dashboard summary for user: ${userId}`);
    const summaryData = await analyticsService.getUserDashboardSummary(userId);
    return sendSuccessResponse(
        res,
        HTTP_STATUS_CODES.OK,
        summaryData,
        "User dashboard summary fetched successfully."
    );
};


export const getUserCoinUsageController = async (req, res) => {
    if (!req.user || !req.user._id) {
        logger.error("[Analytics Controller] User not found in request for coin usage. Auth issue?");
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User authentication not found.");
    }
    const userId = req.user._id.toString();
    logger.info(`[Analytics Controller] Request for coin usage for user: ${userId}`);

    const coinUsageData = await analyticsService.getUserCoinUsageBreakdown(userId);
    // The service function getUserCoinUsageBreakdown should return an array like:
    // [{ coin: 'BTC', totalInvestedUSD: 5000, count: 1 }, ...]

    return sendSuccessResponse(
        res,
        HTTP_STATUS_CODES.OK,
        coinUsageData, // This will be the `data` field in the API response
        "User coin usage breakdown fetched successfully."
    );
};

// Add other analytics controller functions here if needed, for example:
// export const getUserCoinUsageController = async (req, res) => { ... };