import {analyticsSupportService} from '../services/index.js';
import { ApiResponse } from '../utils/index.js';
import logger from '../utils/logger.util.js';

export const getSupportAnalytics = async (req, res) => {
    // queryOptions could include date ranges, specific agent filters, etc.
    // For example: req.query.startDate, req.query.endDate, req.query.agentId
    const queryOptions = req.query;

    // Ensure only support_admin can access comprehensive analytics, or filter by agentId for support_agent
    if (req.agent.role === 'support_agent' && !queryOptions.agentId) {
        queryOptions.agentId = req.agent._id.toString(); // Agent can only see their own analytics by default
    } else if (req.agent.role === 'support_agent' && queryOptions.agentId !== req.agent._id.toString()) {
        throw new ApiError(403, "Support agents can only view their own analytics.");
    }

    const analyticsData = await analyticsSupportService.getSupportAnalyticsService(queryOptions);
    return res
        .status(200)
        .json(new ApiResponse(200, analyticsData, "Support analytics fetched successfully"));
};