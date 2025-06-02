// src/controllers/user.controller.js (Backend)
import { userService, otpService } from '../services/index.js'; // Backend services
import { sendSuccessResponse } from '../utils/apiResponse.util.js';
import ApiError from '../utils/apiError.util.js'; // Import base ApiError for throwing
import {
    HTTP_STATUS_CODES,
    OTP_PURPOSES,
    DEFAULT_PAGINATION_LIMIT,
    MAX_PAGINATION_LIMIT,
    LOG_LEVELS,
    LOG_EVENT_TYPES
} from '../constants/index.js';
import { pick } from '../utils/index.js';
import { Log } from '../models/index.js'; // For direct Log queries
import { createLogEntry } from '../services/log.service.js';


export const getMyProfile = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not authenticated or ID missing.");
    }
    const userId = req.user._id.toString();

    const user = await userService.findUserById(userId, '-password -refreshToken -__v -emailVerificationToken -passwordResetToken -pinChangeToken -pinChangeTokenExpires -twoFactorSecret');

    const userPayload = user.toObject ? user.toObject() : { ...user };

    // Add hasWalletPin property
    userPayload.hasWalletPin = !!user.walletPin; // Check if walletPin is set

    delete userPayload.walletPin; // Remove the walletPin field itself (don't send the hash to the client)
    delete userPayload.status;
    delete userPayload.registrationIp;
    delete userPayload.twoFactorEnabled;
    delete userPayload.createdAt;
    delete userPayload.updatedAt;
    delete userPayload.lastLoginAt;
    delete userPayload.lastLoginIp;
    delete userPayload.kycStatus;

    userPayload.payoutWalletAddresses = user.payoutWalletAddresses; // Include payoutWalletAddresses


    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, userPayload, "Profile fetched successfully.");
};

// This function correctly uses req.user populated by verifyJWT
export const getCurrentAuthenticatedUser = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not authenticated or user data missing from request.");
    }

    const userPayload = req.user.toObject ? req.user.toObject() : { ...req.user };

    delete userPayload.password;
    delete userPayload.walletPin;
    delete userPayload.refreshToken;
    delete userPayload.emailVerificationToken;
    delete userPayload.emailVerificationTokenExpires;
    delete userPayload.passwordResetToken;
    delete userPayload.passwordResetTokenExpires;
    delete userPayload.pinChangeToken;
    delete userPayload.pinChangeTokenExpires;
    delete userPayload.twoFactorSecret;
    delete userPayload.__v;

    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, userPayload, "Current user data fetched successfully.");
};

export const updateMyProfile = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not authenticated.");
    }
    const userId = req.user._id.toString(); // Correct
    const updateData = pick(req.body, ['fullName', 'phoneNumber', 'country', 'preferredCrypto']);
    const updatedUser = await userService.updateUserProfile(userId, updateData);
    const publicUser = pick(updatedUser.toObject(), ['_id', 'fullName', 'email', 'phoneNumber', 'country', 'preferredCrypto', 'role', 'isEmailVerified', 'kycStatus', 'payoutWalletAddresses']);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, publicUser, "Profile updated successfully.");
};

export const changeMyPassword = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not authenticated.");
    }
    const userId = req.user._id.toString(); // Correct
    const { currentPassword, newPassword } = req.body;
    await userService.changeUserPassword(userId, currentPassword, newPassword);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, null, "Password changed successfully.");
};

export const setMyWalletPin = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not authenticated.");
    }
    const userId = req.user._id.toString(); // Correct
    const { pin } = req.body;
    await userService.setWalletPinService(userId, pin);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, null, "Wallet PIN set successfully.");
};

export const requestPinChangeOtp = async (req, res) => {
    if (!req.user || !req.user.email) { // Correct: need email
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not authenticated or email missing.");
    }
    // No need to call findUserById if req.user.email is available and sufficient for otpService
    await otpService.generateAndSendOtp(req.user.email, OTP_PURPOSES.PIN_CHANGE);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, null, "OTP for PIN change sent to your email.");
};

export const changeMyWalletPin = async (req, res) => {
    if (!req.user || !req.user._id) { // Correct: need _id for service
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not authenticated.");
    }
    const userId = req.user._id.toString(); // Correct
    const { otp, newPin } = req.body;
    await userService.changeWalletPinWithOtpService(userId, otp, newPin); // Assumes service handles fetching user if needed
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, null, "Wallet PIN changed successfully.");
};

export const setMyPayoutWalletAddress = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not authenticated.");
    }
    const userId = req.user._id.toString(); // Correct
    const { cryptoSymbol, address, pin } = req.body;
    const result = await userService.setPayoutWalletAddressService(userId, cryptoSymbol, address, pin);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, null, result.message);
};

export const requestWalletChangeOtp = async (req, res) => {
    if (!req.user || !req.user.email) { // Correct: need email
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not authenticated or email missing.");
    }
    await otpService.generateAndSendOtp(req.user.email, OTP_PURPOSES.WALLET_ADDRESS_CHANGE);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, null, "OTP for changing wallet address sent to your email.");
};

export const changeMyPayoutWalletAddress = async (req, res) => {
    if (!req.user || !req.user._id || !req.user.email) { // Correct: need _id and email
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not authenticated or email missing.");
    }
    const userId = req.user._id.toString(); // Correct
    const userEmail = req.user.email;       // Correct
    const { cryptoSymbol, address, otp } = req.body;

    // This logic MUST be in the service layer.
    await userService.changePayoutWalletAddressWithOtpService(userId, userEmail, cryptoSymbol, address, otp);

    // The logging should also ideally be in the service after successful operation.
    // await createLogEntry(LOG_LEVELS.USER_ACTION, LOG_EVENT_TYPES.USER_PAYOUT_WALLET_CHANGED, `User ${userEmail} changed payout wallet for ${cryptoSymbol} to ${address} via OTP.`, userId);

    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, null, `Payout wallet for ${cryptoSymbol} updated successfully.`);
};

export const getMyActivityLogController = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not authenticated.");
    }
    const userId = req.user._id.toString(); // Correct
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || DEFAULT_PAGINATION_LIMIT;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = { user: userId };

    const logs = await Log.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * Math.min(limit, MAX_PAGINATION_LIMIT))
        .limit(Math.min(limit, MAX_PAGINATION_LIMIT))
        .select('eventType message createdAt ipAddress details -_id')
        .lean();

    const totalLogs = await Log.countDocuments(query);

    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, {
        logs,
        totalPages: Math.ceil(totalLogs / Math.min(limit, MAX_PAGINATION_LIMIT)),
        currentPage: page,
        totalLogs
    }, "User activity log fetched successfully.");
};

export const updatePreferredCrypto = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User not authenticated.");
    }
    const userId = req.user._id.toString();
    const { preferredPayoutCrypto } = req.body;

    const updateData = { preferredPayoutCrypto };
    const updatedUser = await userService.updateUserProfile(userId, updateData);

    const publicUser = pick(updatedUser.toObject(), ['_id', 'fullName', 'email', 'phoneNumber', 'country', 'preferredPayoutCrypto', 'role', 'isEmailVerified', 'kycStatus', 'payoutWalletAddresses']);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, publicUser, "Preferred crypto updated successfully.");
};

export const getMyNotificationsController = async (req, res) => {
    const userId = req.user._id.toString();
    const queryParams = pick(req.query, ['page', 'limit']); // Add other filters if needed

    const notificationData = await userService.getUserNotifications(userId, queryParams);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, notificationData, "Notifications fetched successfully.");
};

export const markNotificationReadController = async (req, res) => {
    const userId = req.user._id.toString();     
    const { notificationId } = req.params;

    const result = await userService.markNotificationAsRead(userId, notificationId);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, result.notification, result.message);
};

export const markAllNotificationsReadController = async (req, res) => {
    const userId = req.user._id.toString();
    const result = await userService.markAllUserNotificationsAsRead(userId);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, { modifiedCount: result.modifiedCount }, result.message);
};


// TODO: KYC Submission Controller: export const submitKycController = async (req, res) => { ... }
// TODO: 2FA Setup Controllers: export const setupTwoFactorController = async (req, res) => { ... }
//                              export const verifyTwoFactorController = async (req, res) => { ... }
//                              export const disableTwoFactorController = async (req, res) => { ... }