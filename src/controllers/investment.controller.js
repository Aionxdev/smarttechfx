// // src/controllers/investment.controller.js
// import { investmentService, planService } from '../services/index.js';
// import { ApiResponse, sendSuccessResponse } from '../utils/apiResponse.util.js';
// import { HTTP_STATUS_CODES } from '../constants/index.js';
// import { pick } from '../utils/index.js';
// import logger from '../utils/logger.util.js';             // Backend logger


// export const createInvestment = async (req, res) => {
//     if (!req.user || !req.user.userId) {
//         throw new ApiResponse(HTTP_STATUS_CODES.UNAUTHORIZED, "User authentication not found.");
//     }
//     // Ensure req.user.userId is available
//     // const userId = String(req.user.userId) || req.user._id.toString(); // Ensure userId is a string
//     req.user.userId || req.user._id.toString(); // Fallback to _id if userId is not available
//     // const userId = req.user.userId;
//     const ipAddress = req.ip;
//     const { planId, investedAmountUSD, paymentCryptocurrency, transactionId: userProvidedTxid } = req.body;

//     const result = await investmentService.initiateInvestment(
//         userId,
//         planId,
//         parseFloat(investedAmountUSD),
//         paymentCryptocurrency,
//         userProvidedTxid,
//         ipAddress
//     );
//     return sendSuccessResponse(res, HTTP_STATUS_CODES.CREATED, result, result.message);
// };


// export const getMyInvestments = async (req, res) => {
//     if (!req.user || !req.user._id) {
//         throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User authentication not found.");
//     }
//     const userId = req.user._id.toString();
//     const queryParams = pick(req.query, ['page', 'limit', 'status', 'sortBy', 'sortOrder']);

//     // Pass userId to the service function
//     const investmentsData = await investmentService.getUserInvestments(userId, queryParams);
//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, investmentsData, "User investments fetched successfully.");
// };

// export const getMyInvestmentById = async (req, res) => {
//     if (!req.user || !req.user._id) {
//         throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User authentication not found.");
//     }
//     const userId = req.user._id.toString(); // Ensure userId is a string
//     const { investmentId } = req.params;
//     // const userId = req.user.userId;
//     // const { investmentId } = req.params;
//     const investment = await investmentService.getInvestmentByIdForUser(investmentId, userId);
//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, investment, "Investment details fetched successfully.");
// };

// // Existing function
// export const getAvailableInvestmentPlans = async (req, res) => {
//     // This typically returns just the core plan data for selection
//     const plans = await planService.getActiveInvestmentPlansForUser();
//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, plans, "Available investment plans fetched successfully.");
// };


// // ROI Progress Tracker (this would likely be part of getMyInvestmentById or a dedicated endpoint)
// // The investment model/service should calculate current progress.
// export const getInvestmentProgress = async (req, res) => {
//     const userId = req.user.userId;
//     const { investmentId } = req.params;
//     const investment = await investmentService.getInvestmentByIdForUser(investmentId, userId);

//     // Calculate progress (example)
//     let progressPercent = 0;
//     if (investment.status === 'Active' && investment.activationDate && investment.maturityDate) {
//         const totalDurationMs = new Date(investment.maturityDate).getTime() - new Date(investment.activationDate).getTime();
//         const elapsedMs = Date.now() - new Date(investment.activationDate).getTime();
//         progressPercent = totalDurationMs > 0 ? Math.min(100, (elapsedMs / totalDurationMs) * 100) : 0;
//     } else if (investment.status === 'Matured' || investment.status === 'Withdrawn') {
//         progressPercent = 100;
//     }

//     const progressData = {
//         investmentId: investment._id,
//         status: investment.status,
//         progressPercent: parseFloat(progressPercent.toFixed(2)),
//         currentProfitUSD: investment.currentProfitUSD || 0, // Needs to be updated by a cron or calculation
//         expectedTotalProfitUSD: investment.expectedTotalProfitUSD,
//         maturityDate: investment.maturityDate,
//     };
//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, progressData, "Investment progress fetched.");
// };

// // Submit TXID for manual verification
// export const submitInvestmentTxid = async (req, res) => {
//     const userId = req.user.userId; // From verifyJWT middleware
//     const { investmentId } = req.params;
//     const { transactionId } = req.body;

//     const result = await investmentService.userSubmitTxidForInvestment(userId, investmentId, transactionId);

//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, result, result.message);
// };

// export const getPublicInvestmentPlanGuide = async (req, res) => {
//     logger.info('[Investment Controller Backend] Request received for public investment plan guide.');
//     // No specific parameters from req needed for this public guide
//     const planGuideData = await planService.getInvestmentPlanGuide(); // Calls the service function

//     logger.info(`[Investment Controller Backend] Plan guide data fetched, sending response. Count: ${planGuideData.length}`);
//     return sendSuccessResponse(
//         res,
//         HTTP_STATUS_CODES.OK,
//         planGuideData, // This directly becomes the `data` field in the JSON response
//         "Investment plan guide fetched successfully."
//     );
// };

// export const getInvestmentProgressController = async (req, res) => {
//     if (!req.user || !req.user._id) throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not found.");
//     const userId = req.user._id.toString();
//     const { investmentId } = req.params;

//     logger.info(`[Investment Controller] Request for investment progress for invId: ${investmentId}, user: ${userId}`);
//     // The service needs to be robust here.
//     const progressData = await investmentService.getInvestmentProgressDetails(investmentId, userId);
//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, progressData, "Investment progress fetched.");
// };

// src/controllers/investment.controller.js (Backend)
import { investmentService, planService } from '../services/index.js';
import { sendSuccessResponse } from '../utils/apiResponse.util.js'; // For successful responses
import ApiError, { UnauthorizedError, NotFoundError } from '../utils/apiError.util.js'; // For throwing errors
import { HTTP_STATUS_CODES, INVESTMENT_STATUS } from '../constants/index.js'; // Ensure INVESTMENT_STATUS is available if used
import { pick } from '../utils/index.js';
import logger from '../utils/logger.util.js';

export const createInvestment = async (req, res) => {
    // Ensure user is authenticated and req.user._id is available
    if (!req.user || !req.user._id) {
        // Use ApiError or a specific subclass like UnauthorizedError
        throw new UnauthorizedError("User authentication not found. Please log in.");
    }
    const userId = req.user._id.toString(); // Use _id from the Mongoose user object populated by verifyJWT
    const ipAddress = req.ip;
    const { planId, investedAmountUSD, paymentCryptocurrency, transactionId: userProvidedTxid } = req.body;

    // Basic validation (more robust validation should be in middleware)
    if (!planId || investedAmountUSD === undefined || !paymentCryptocurrency) {
        throw new ApiError(HTTP_STATUS_CODES.BAD_REQUEST, "Plan ID, investment amount, and payment cryptocurrency are required.");
    }
    if (parseFloat(investedAmountUSD) <= 0) {
        throw new ApiError(HTTP_STATUS_CODES.BAD_REQUEST, "Investment amount must be a positive number.");
    }

    const result = await investmentService.initiateInvestment(
        userId,
        planId,
        parseFloat(investedAmountUSD),
        paymentCryptocurrency,
        userProvidedTxid,
        ipAddress
    );
    // result from service should ideally be the data payload directly
    // or an object { success, data, message } where data is payload.
    // Assuming service returns data payload directly for success, or throws ApiError on failure.
    return sendSuccessResponse(res, HTTP_STATUS_CODES.CREATED, result.data || result, result.message || "Investment initiated successfully.");
};

export const getMyInvestments = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new UnauthorizedError("User authentication not found.");
    }
    const userId = req.user._id.toString();
    const queryParams = pick(req.query, ['page', 'limit', 'status', 'sortBy', 'sortOrder']);

    const investmentsData = await investmentService.getUserInvestments(userId, queryParams);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, investmentsData, "User investments fetched successfully.");
};

export const getMyInvestmentById = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new UnauthorizedError("User authentication not found.");
    }
    const userId = req.user._id.toString();
    const { investmentId } = req.params;

    const investment = await investmentService.getInvestmentByIdForUser(investmentId, userId);
    if (!investment) { // Service should throw NotFoundError, but good to double check
        throw new NotFoundError("Investment not found or access denied.");
    }
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, investment, "Investment details fetched successfully.");
};

export const getAvailableInvestmentPlans = async (req, res) => {
    // This is a public or semi-public endpoint, might not strictly need req.user
    // but if plans are user-specific in any way, auth check would be here.
    // Assuming planService.getActiveInvestmentPlansForUser is designed for general viewing.
    const plans = await planService.getActiveInvestmentPlansForUser();
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, plans, "Available investment plans fetched successfully.");
};

// Consolidated and improved getInvestmentProgress
export const getInvestmentProgress = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new UnauthorizedError("User authentication not found.");
    }
    const userId = req.user._id.toString();
    const { investmentId } = req.params;

    logger.info(`[Investment Controller] Request for investment progress for invId: ${investmentId}, user: ${userId}`);

    // Delegate the calculation and data fetching entirely to the service
    const progressData = await investmentService.getInvestmentProgressDetails(investmentId, userId);
    // getInvestmentProgressDetails service should return the structure needed or throw error

    if (!progressData) { // If service returns null for not found / not accessible
        throw new NotFoundError("Investment progress details not found or access denied.");
    }

    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, progressData, "Investment progress fetched successfully.");
};

export const submitInvestmentTxid = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new UnauthorizedError("User authentication not found.");
    }
    const userId = req.user._id.toString();
    const { investmentId } = req.params;
    const { transactionId } = req.body;

    if (!transactionId) {
        throw new ApiError(HTTP_STATUS_CODES.BAD_REQUEST, "Transaction ID is required.");
    }

    const result = await investmentService.userSubmitTxidForInvestment(userId, investmentId, transactionId);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, result.data || result, result.message || "TXID submitted successfully.");
};

export const getPublicInvestmentPlanGuide = async (req, res) => {
    logger.info('[Investment Controller Backend] Request received for public investment plan guide.');
    const planGuideData = await planService.getInvestmentPlanGuide();
    logger.info(`[Investment Controller Backend] Plan guide data fetched, sending response. Count: ${planGuideData?.length || 0}`);
    return sendSuccessResponse(
        res,
        HTTP_STATUS_CODES.OK,
        planGuideData,
        "Investment plan guide fetched successfully."
    );
};

// Removed the duplicate getInvestmentProgressController as it's consolidated into getInvestmentProgress