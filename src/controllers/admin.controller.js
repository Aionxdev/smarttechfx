// src/controllers/admin.controller.js
import {
    userService,
    investmentService,
    withdrawalService,
    planService, // Though plan management has its own controller, some overview might be here
    analyticsService,
    // logService, // Direct Log model usage or via analyticsService
    // notificationService, // For broadcasting
    // cryptoManagementService, // For managing SupportedCrypto
} from '../services/index.js';
import { User, Investment, Withdrawal, SupportedCrypto, Notification, Log } from '../models/index.js'; // Direct model access for some simpler ops
import { ApiResponse, sendSuccessResponse } from '../utils/apiResponse.util.js';
import ApiError, { NotFoundError, BadRequestError } from '../utils/apiError.util.js';
import { 
    HTTP_STATUS_CODES, 
    LOG_LEVELS, 
    USER_ROLES, 
    ACCOUNT_STATUS, 
    KYC_STATUS, 
    INVESTMENT_STATUS, 
    WITHDRAWAL_STATUS, 
    SUPPORTED_CRYPTO_SYMBOLS, 
    NOTIFICATION_TYPES,
    LOG_EVENT_TYPES,
     
} from '../constants/index.js';
import { pick } from '../utils/index.js';
import { createLogEntry } from '../services/log.service.js';
import logger from '../utils/logger.util.js'; // Assuming you have a logger utility

// --- Dashboard Overview ---
export const getAdminDashboardOverview = async (req, res) => {
    logger.info('[Admin Controller Backend] Request for admin dashboard overview.');
    const overviewData = await analyticsService.getAdminDashboardData(); // Call the single comprehensive function

    return sendSuccessResponse(
        res,
        HTTP_STATUS_CODES.OK,
        overviewData,
        "Admin dashboard overview fetched successfully."
    );
};


// --- User Management (Admin) ---
export const getAllUsersAdmin = async (req, res) => {
    const queryParams = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder', 'role', 'status', 'email', 'fullName']);
    // A dedicated service method in userService for admin fetching users would be cleaner
    // For now, a direct query:
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = parseInt(queryParams.limit, 10) || 10;
    const filter = { role: { $ne: USER_ROLES.ADMIN } }; // Exclude other admins by default
    if (queryParams.role) filter.role = queryParams.role;
    if (queryParams.status) filter.status = queryParams.status;
    if (queryParams.email) filter.email = { $regex: queryParams.email, $options: 'i' };
    if (queryParams.fullName) filter.fullName = { $regex: queryParams.fullName, $options: 'i' };


    const users = await User.find(filter)
        .sort({ [queryParams.sortBy || 'createdAt']: queryParams.sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-password -walletPin -refreshToken') // Exclude sensitive fields
        .lean();
    const totalUsers = await User.countDocuments(filter);

    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, {
        users,
        totalPages: Math.ceil(totalUsers / limit),
        currentPage: page,
        totalUsers
    }, "Users fetched successfully.");
};

export const getUserDetailsAdmin = async (req, res) => {
    const { userId } = req.params;
    const user = await userService.findUserById(userId, '-password -walletPin -refreshToken'); // Exclude sensitive fields
    // Could also populate user's investments/withdrawals here or have separate endpoints
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, user, "User details fetched successfully.");
};

export const updateUserStatusAdmin = async (req, res) => {
    const adminUserId = req.user.userId;
    const { userId } = req.params;
    const { status, reason } = req.body; // status: Active, Suspended, Deactivated

    if (!Object.values(ACCOUNT_STATUS).includes(status)) {
        throw new BadRequestError("Invalid account status provided.");
    }
    if ((status === ACCOUNT_STATUS.SUSPENDED || status === ACCOUNT_STATUS.DEACTIVATED) && !reason) {
        throw new BadRequestError("Reason is required for suspension or deactivation.");
    }

    const user = await userService.findUserById(userId);
    if (user.role === USER_ROLES.ADMIN) {
        throw new ForbiddenError("Cannot change status of an admin account through this endpoint.");
    }

    user.status = status;
    // user.statusChangeReason = reason; // Add a field to User model if needed
    await user.save();

    await createLogEntry(
        LOG_LEVELS.ADMIN_ACTION,
        user.status === ACCOUNT_STATUS.SUSPENDED ? LOG_EVENT_TYPES.ADMIN_USER_BANNED : LOG_EVENT_TYPES.ADMIN_USER_STATUS_CHANGED,
        `Admin ${adminUserId} changed status of user ${user.email} (ID: ${userId}) to ${status}. Reason: ${reason || 'N/A'}`,
        userId, { previousStatus: user.status, newStatus: status, reason }, null, adminUserId
    );

    // TODO: Send email notification to user about status change
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, pick(user.toObject(), ['_id', 'email', 'status']), "User status updated successfully.");
};

export const updateUserKycStatusAdmin = async (req, res) => {
    const adminUserId = req.user.userId;
    const { userId } = req.params;
    const { kycStatus, rejectionReason } = req.body;

    if (!Object.values(KYC_STATUS).includes(kycStatus)) {
        throw new BadRequestError("Invalid KYC status provided.");
    }
    if (kycStatus === KYC_STATUS.REJECTED && !rejectionReason) {
        throw new BadRequestError("Rejection reason is required for KYC rejection.");
    }

    const user = await userService.findUserById(userId);
    if (!user.kycDetails || user.kycStatus === KYC_STATUS.NOT_SUBMITTED) {
        throw new BadRequestError("User has not submitted KYC documents or details are missing.");
    }

    const oldKycStatus = user.kycStatus;
    user.kycStatus = kycStatus;
    user.kycDetails.reviewedAt = new Date();
    user.kycDetails.reviewedBy = adminUserId;
    if (kycStatus === KYC_STATUS.REJECTED) {
        user.kycDetails.rejectionReason = rejectionReason;
    } else {
        user.kycDetails.rejectionReason = undefined; // Clear if approved/pending
    }
    await user.save();

    const logEventType = kycStatus === KYC_STATUS.VERIFIED ? LOG_EVENT_TYPES.ADMIN_KYC_APPROVED : LOG_EVENT_TYPES.ADMIN_KYC_REJECTED; // Add these
    await createLogEntry(
        LOG_LEVELS.ADMIN_ACTION, logEventType,
        `Admin ${adminUserId} updated KYC status of user ${user.email} to ${kycStatus}. ${rejectionReason ? 'Reason: ' + rejectionReason : ''}`,
        userId, { oldKycStatus, newKycStatus: kycStatus, rejectionReason }, null, adminUserId
    );

    // TODO: Send email to user: sendKycStatusUpdateEmail(user.email, kycStatus, rejectionReason);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, pick(user.toObject(), ['_id', 'email', 'kycStatus', 'kycDetails']), "User KYC status updated.");
};


// --- Investment Management (Admin) ---
export const getAllInvestmentsAdmin = async (req, res) => {
    const queryParams = pick(req.query, ['page', 'limit', 'status', 'userId', 'planId', 'sortBy', 'sortOrder']);
    const investmentsData = await investmentService.adminGetAllInvestments(queryParams);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, investmentsData, "All investments fetched successfully.");
};

export const getInvestmentDetailsAdmin = async (req, res) => {
    const { investmentId } = req.params;
    const investment = await investmentService.adminGetInvestmentById(investmentId);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, investment, "Investment details fetched successfully.");
};

export const verifyInvestmentByAdmin = async (req, res) => {
    const adminUserId = req.user.userId;
    const { investmentId } = req.params;
    // These names match your JSON and the new validator
    const { transactionId: confirmedUserTxid, actualCryptoAmountReceived, adminNotes } = req.body;

    if (!confirmedUserTxid || actualCryptoAmountReceived === undefined) {
        // This redundant check can be removed if validator handles it, but doesn't hurt
        throw new BadRequestError("Confirmed blockchain Transaction ID (TXID) and actual crypto amount received are required.");
    }
    if (parseFloat(actualCryptoAmountReceived) <= 0) {
        // Also handled by validator
        throw new BadRequestError("Actual crypto amount received must be positive.");
    }

    const activatedInvestment = await investmentService.adminVerifyAndActivateInvestment(
        adminUserId,
        investmentId,
        parseFloat(actualCryptoAmountReceived),
        confirmedUserTxid, // Pass the confirmed TXID
        // adminNotes // Pass adminNotes to the service if your service function accepts it
    );
    // Make sure your investmentService.adminVerifyAndActivateInvestment accepts adminNotes if you want to save them.
    // If adminNotes is part of the validator and body, the service function:
    // adminVerifyAndActivateInvestment = async (adminUserId, investmentId, actualCryptoAmountReceived, userTxid, adminNotesParam = null)
    // then inside: investment.adminNotes = adminNotesParam || investment.adminNotes; (or similar logic)

    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, activatedInvestment, "Investment verified and activated successfully.");
};

export const cancelPendingInvestmentByAdmin = async (req, res) => {
    const adminUserId = req.user.userId;
    const { investmentId } = req.params;
    const { reason } = req.body;
    if (!reason) throw new BadRequestError("Reason for cancellation is required.");

    const cancelledInvestment = await investmentService.adminCancelPendingInvestment(adminUserId, investmentId, reason);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, cancelledInvestment, "Pending investment cancelled successfully.");
};

// --- Withdrawal Management (Admin) ---
export const getAllWithdrawalsAdmin = async (req, res) => {
    const queryParams = pick(req.query, ['page', 'limit', 'status', 'userId', 'sortBy', 'sortOrder']);
    const withdrawalsData = await withdrawalService.adminGetAllWithdrawals(queryParams);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, withdrawalsData, "All withdrawal requests fetched successfully.");
};

export const approveWithdrawalByAdmin = async (req, res) => {
    const adminUserId = req.user.userId;
    const { withdrawalId } = req.params;
    const { platformTransactionId } = req.body; // Admin provides the TXID of the payout transaction

    if (!platformTransactionId) {
        throw new BadRequestError("Platform transaction ID (TXID) is required for approving withdrawal.");
    }
    const approvedWithdrawal = await withdrawalService.adminApproveWithdrawal(adminUserId, withdrawalId, platformTransactionId);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, approvedWithdrawal, "Withdrawal approved and processed successfully.");
};

export const rejectWithdrawalByAdmin = async (req, res) => {
    const adminUserId = req.user.userId;
    const { withdrawalId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
        throw new BadRequestError("Rejection reason is required.");
    }
    const rejectedWithdrawal = await withdrawalService.adminRejectWithdrawal(adminUserId, withdrawalId, rejectionReason);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, rejectedWithdrawal, "Withdrawal request rejected successfully.");
};


// --- Platform Settings & Content Management (Admin) ---
export const manageSupportedCryptos = async (req, res) => {
    // GET: List all supported cryptos
    if (req.method === 'GET') {
        const cryptos = await SupportedCrypto.find().sort({ displayOrder: 1, name: 1 }).lean();
        return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, cryptos, "Supported cryptocurrencies fetched.");
    }
    // POST: Add a new crypto
    if (req.method === 'POST') {
        const adminUserId = req.user.userId;
        const { name, symbol, platformDepositWalletAddress, isActiveForInvestment, isActiveForPayout, networkConfirmationThreshold, displayOrder, iconUrl } = req.body;
        // Validation should be here or in a validator
        const existing = await SupportedCrypto.findOne({ symbol: symbol.toUpperCase() });
        if (existing) throw new ConflictError(`Cryptocurrency ${symbol} already exists.`);

        const newCrypto = await SupportedCrypto.create({
            name, symbol: symbol.toUpperCase(), platformDepositWalletAddress,
            isActiveForInvestment, isActiveForPayout, networkConfirmationThreshold, displayOrder, iconUrl,
            // createdBy: adminUserId, // Add fields if needed
        });
        return sendSuccessResponse(res, HTTP_STATUS_CODES.CREATED, newCrypto, `${symbol} added to supported cryptocurrencies.`);
    }
};
export const updateSupportedCrypto = async (req, res) => {
    // PUT: Update an existing crypto
    const adminUserId = req.user.userId;
    const { cryptoId } = req.params;
    const updateData = pick(req.body, ['name', 'platformDepositWalletAddress', 'isActiveForInvestment', 'isActiveForPayout', 'networkConfirmationThreshold', 'displayOrder', 'iconUrl', 'notes']);
    // Symbol change should ideally not be allowed or handled very carefully

    const updatedCrypto = await SupportedCrypto.findByIdAndUpdate(cryptoId, updateData, { new: true });
    if (!updatedCrypto) throw new NotFoundError("Supported crypto not found.");
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, updatedCrypto, `${updatedCrypto.symbol} details updated.`);
};


export const broadcastAnnouncement = async (req, res) => {
    const adminUserId = req.user.userId;
    const { title, message, targetRoles, isEmergency } = req.body; // targetRoles: e.g., ["Investor"], or null for all

    if (!title || !message) {
        throw new BadRequestError("Title and message are required for announcement.");
    }

    // Create a system-wide notification
    const announcement = await Notification.create({
        type: NOTIFICATION_TYPES.ANNOUNCEMENT,
        title,
        message,
        isBroadcast: true,
        targetRoles: targetRoles && targetRoles.length > 0 ? targetRoles : Object.values(USER_ROLES), // Default to all if not specified
        // createdBy: adminUserId, // Add a field if you want to track who sent it
    });

    await createLogEntry(
        LOG_LEVELS.ADMIN_ACTION, LOG_EVENT_TYPES.ADMIN_BROADCAST_SENT,
        `Admin ${adminUserId} sent broadcast: "${title}"`, null,
        { title, targetRoles: announcement.targetRoles }, null, adminUserId
    );

    // TODO: Implement actual push to users (e.g., WebSockets, or users fetch notifications)
    // For now, it's just stored in DB.
    return sendSuccessResponse(res, HTTP_STATUS_CODES.CREATED, announcement, "Announcement broadcasted successfully.");
};


// --- Analytics & Logs (Admin) ---
export const getPlatformAnalytics = async (req, res) => {
    // This could be a wrapper for various analyticsService calls
    const userStats = await analyticsService.getPlatformUserStats();
    const investmentStats = await analyticsService.getPlatformInvestmentStats();
    const planPopularity = await analyticsService.getPlatformPlanPopularity();
    const roiOwed = await analyticsService.getSystemROIOwed();
    const withdrawalTrends = await analyticsService.getWithdrawalTrends(req.query.period || 'monthly');
    const userLeaderboard = await analyticsService.getUserLeaderboardByVolume(parseInt(req.query.leaderboardLimit, 10) || 10);

    const platformAnalytics = {
        userStats,
        investmentStats,
        planPopularity,
        roiOwed,
        withdrawalTrends,
        userLeaderboard,
    };
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, platformAnalytics, "Platform analytics fetched successfully.");
};

export const viewSystemLogs = async (req, res) => {
    const { page = 1, limit = 20, level, eventType, userId, sortBy = 'createdAt', sortOrder = 'desc' } = pick(req.query, ['page', 'limit', 'level', 'eventType', 'userId', 'sortBy', 'sortOrder']);

    const query = {};
    if (level) query.level = level;
    if (eventType) query.eventType = eventType;
    if (userId) query.user = userId;

    const logs = await Log.find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
        .limit(parseInt(limit, 10))
        .populate('user', 'email fullName') // Populate user if userId is present
        .populate('adminUser', 'email fullName') // Populate adminUser if present
        .lean();

    const totalLogs = await Log.countDocuments(query);

    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, {
        logs,
        totalPages: Math.ceil(totalLogs / parseInt(limit, 10)),
        currentPage: parseInt(page, 10),
        totalLogs
    }, "System logs fetched successfully.");
};

export const getAllAnnouncementsAdmin = async (req, res) => {
    // Add pagination if needed
    const announcements = await Notification.find({ isBroadcast: true })
        .sort({ createdAt: -1 })
        .lean();
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, announcements, "All announcements fetched.");
};

export const deleteAnnouncementAdmin = async (req, res) => {
    const { notificationId } = req.params;
    const result = await Notification.findOneAndDelete({ _id: notificationId, isBroadcast: true });
    if (!result) throw new NotFoundError("Announcement not found or not a broadcast.");
    // Log deletion
    await createLogEntry(LOG_LEVELS.ADMIN_ACTION, LOG_EVENT_TYPES.ADMIN_BROADCAST_DELETED, /* ... */);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, null, "Announcement deleted successfully.");
};


// View Chat History (AI & Human Support) - See support.controller.js for escalated chats
// If you store AI chats temporarily (e.g., in Redis or a temp DB collection), an endpoint here could access them.
// For now, we only have escalated chats.