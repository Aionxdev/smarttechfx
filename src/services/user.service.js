import { User, OTPSession, Log, Notification } from '../models/index.js';
import ApiError, {
    NotFoundError, 
    BadRequestError, 
    ForbiddenError, 
    ConflictError, 
    UnauthorizedError 
} from '../utils/apiError.util.js';
import { sendSuccessResponse } from '../utils/apiResponse.util.js'; 
import {
    HTTP_STATUS_CODES,
    ACCOUNT_STATUS,
    KYC_STATUS,
    USER_ROLES,
    OTP_PURPOSES,
    LOG_EVENT_TYPES,
    LOG_LEVELS,
    DEFAULT_PAGINATION_LIMIT,
    MAX_PAGINATION_LIMIT,
} from '../constants/index.js';
import logger from '../utils/logger.util.js';
import { generateAndSendOtp, verifyOtp } from './otp.service.js';
import { sendWelcomeEmail } from './email.service.js'; // Assuming other email functions are in email.service.js
import { hashData, compareData } from '../utils/bcrypt.helper.js'; // We'll create this helper
import { createLogEntry } from './log.service.js'; // Assuming direct import path

import mongoose from 'mongoose';

import { sendPasswordResetEmail } from './email.service.js'; // For sending the email
import crypto from 'crypto'; // For hashing the token if you store it hashed (as in User model example)
import config from '../config/index.js'; // For accessing environment variables
import jwt from 'jsonwebtoken'; 




// It's good practice to have a bcrypt helper
// Create src/utils/bcrypt.helper.js
/*
// src/utils/bcrypt.helper.js
import bcrypt from 'bcryptjs';

export const hashData = async (data, saltRounds = 10) => {
    return bcrypt.hash(String(data), saltRounds);
};

export const compareData = async (data, hashedData) => {
    if (!data || !hashedData) return false;
    return bcrypt.compare(String(data), hashedData);
};
*/


export const registerUser = async (userData, ipAddress) => {
    const { email, password } = userData;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        throw new ConflictError("An account with this email address already exists.");
    }

    // Password hashing is handled by the User model's pre-save hook.
    const user = new User({
        ...userData,
        email: email.toLowerCase(),
        registrationIp: ipAddress,
        status: ACCOUNT_STATUS.PENDING_VERIFICATION, // Start as pending email verification
    });
    await user.save();

    // Send OTP for email verification
    try {
        await generateAndSendOtp(user.email, OTP_PURPOSES.EMAIL_VERIFICATION);
    } catch (otpError) {
        logger.error(`Failed to send verification OTP during registration for ${user.email}:`, otpError);
        // Proceed with registration, user can request OTP again.
        // Or, you could roll back user creation if OTP sending is critical for your flow.
    }

    // Log registration event
    await Log.create({
        level: LOG_LEVELS.USER_ACTION,
        eventType: LOG_EVENT_TYPES.USER_REGISTERED,
        message: `User ${user.email} registered. IP: ${ipAddress}`,
        user: user._id,
        ipAddress: ipAddress,
        details: { email: user.email, fullName: user.fullName }
    });

    // Don't send welcome email until email is verified
    // await sendWelcomeEmail(user.email, user.fullName);

    // Return user data without sensitive fields (password is already excluded by select:false)
    const userObject = user.toObject();
    delete userObject.password; // Ensure it's not there even if select:false was missed
    delete userObject.walletPin;
    return userObject;
};

export const loginUser = async (email, password, ipAddress, userAgent) => {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password'); // Need password for comparison
    if (!user) {
        throw new UnauthorizedError("Invalid email or password.");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
        throw new UnauthorizedError("Invalid email or password.");
    }

    if (user.status === ACCOUNT_STATUS.PENDING_VERIFICATION && !user.isEmailVerified) {
        throw new ForbiddenError("Please verify your email address before logging in. You can request a new verification OTP.");
    }
    if (user.status === ACCOUNT_STATUS.SUSPENDED) {
        throw new ForbiddenError("Your account has been suspended. Please contact support.");
    }
    if (user.status === ACCOUNT_STATUS.DEACTIVATED) {
        throw new ForbiddenError("Your account has been deactivated.");
    }

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken(); // Store this securely (e.g., in DB if not solely cookie)

    // Update last login info
    user.lastLoginAt = new Date();
    user.lastLoginIp = ipAddress;
    // user.refreshToken = refreshToken; // If storing refresh token in DB
    await user.save();

    await Log.create({
        level: LOG_LEVELS.USER_ACTION,
        eventType: LOG_EVENT_TYPES.USER_LOGGED_IN,
        message: `User ${user.email} logged in. IP: ${ipAddress}`,
        user: user._id,
        ipAddress: ipAddress,
        userAgent: userAgent,
        details: { email: user.email }
    });

    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.walletPin;
    // delete userObject.refreshToken; // Don't send DB refresh token to client

    return { user: userObject, accessToken, refreshToken };
};

// export const findUserById = async (userId, selectFields = '') => {
//     const user = await User.findById(userId).select(selectFields);
//     if (!user) {
//         throw new NotFoundError("User not found.");
//     }
//     return user;
// };


// src/services/user.service.js
export const findUserById = async (userId, selectFields = '') => {
    const user = await User.findById(userId).select(selectFields + ' +walletPin'); // Add +walletPin to select
    if (!user) {
        throw new NotFoundError("User not found.");
    }
    return user;
};

// export const updateUserProfile = async (userId, updateData) => {
//     // Prevent updating sensitive fields directly like email (requires verification), role, status etc.
//     const allowedUpdates = ['fullName', 'phoneNumber', 'country', 'preferredPayoutCrypto'];
//     const filteredUpdateData = {};
//     for (const key of allowedUpdates) {
//         if (updateData[key] !== undefined) {
//             filteredUpdateData[key] = updateData[key];
//         }
//     }

//     if (Object.keys(filteredUpdateData).length === 0) {
//         throw new BadRequestError("No valid fields provided for update.");
//     }

//     const user = await User.findByIdAndUpdate(userId, { $set: filteredUpdateData }, { new: true, runValidators: true });
//     if (!user) {
//         throw new NotFoundError("User not found.");
//     }

//     await Log.create({
//         level: LOG_LEVELS.USER_ACTION,
//         eventType: LOG_EVENT_TYPES.USER_PROFILE_UPDATED,
//         message: `User ${user.email} updated their profile.`,
//         user: user._id,
//         details: { updatedFields: Object.keys(filteredUpdateData) }
//     });
//     return user;
// };

// src/services/user.service.js

export const updateUserProfile = async (userId, updateData) => {
    // Prevent updating sensitive fields directly like email (requires verification), role, status etc.
    const allowedUpdates = ['fullName', 'phoneNumber', 'country', 'preferredPayoutCrypto']; // Add preferredPayoutCrypto to allowed updates
    const filteredUpdateData = {};
    for (const key of allowedUpdates) {
        if (updateData[key] !== undefined) {
            filteredUpdateData[key] = updateData[key];
        }
    }

    if (Object.keys(filteredUpdateData).length === 0) {
        throw new BadRequestError("No valid fields provided for update.");
    }

    const user = await User.findByIdAndUpdate(userId, { $set: filteredUpdateData }, { new: true, runValidators: true });
    if (!user) {
        throw new NotFoundError("User not found.");
    }

    await Log.create({
        level: LOG_LEVELS.USER_ACTION,
        eventType: LOG_EVENT_TYPES.USER_PROFILE_UPDATED,
        message: `User ${user.email} updated their profile.`,
        user: user._id,
        details: { updatedFields: Object.keys(filteredUpdateData) }
    });
    return user;
};

export const changeUserPassword = async (userId, oldPassword, newPassword) => {
    const user = await User.findById(userId).select('+password');
    if (!user) {
        throw new NotFoundError("User not found.");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new BadRequestError("Incorrect current password.");
    }

    if (oldPassword === newPassword) {
        throw new BadRequestError("New password cannot be the same as the old password.");
    }

    user.password = newPassword; // Hashing handled by pre-save hook
    await user.save();

    await Log.create({
        level: LOG_LEVELS.USER_ACTION,
        eventType: LOG_EVENT_TYPES.USER_PASSWORD_CHANGED,
        message: `User ${user.email} changed their password.`,
        user: user._id,
    });
    // TODO: Send password change notification email
    return { message: "Password changed successfully." };
};


export const setWalletPinService = async (userId, pin) => {
    const user = await User.findById(userId).select('+walletPin');
    if (!user) throw new NotFoundError("User not found");
    if (user.walletPin) throw new BadRequestError("Wallet PIN already set. Use change PIN functionality.");

    user.walletPin = pin; // Hashing handled by pre-save hook
    await user.save();

    await Log.create({
        level: LOG_LEVELS.USER_ACTION,
        eventType: LOG_EVENT_TYPES.USER_PIN_SET,
        message: `User ${user.email} set their wallet PIN.`,
        user: user._id,
    });
    return { message: "Wallet PIN set successfully." };
};

export const changeWalletPinWithOtpService = async (userId, otp, newPin) => {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError("User not found.");

    await verifyOtp(user.email, otp, OTP_PURPOSES.PIN_CHANGE);

    // Check if new PIN is same as old one (if old one existed and was loaded)
    // This requires loading the walletPin field even if it's `select: false` usually.
    const userWithPin = await User.findById(userId).select('+walletPin');
    if (userWithPin.walletPin) {
        const isSamePin = await compareData(newPin, userWithPin.walletPin); // compareData from bcrypt.helper.js
        if (isSamePin) {
            throw new BadRequestError("New PIN cannot be the same as the current PIN.");
        }
    }

    userWithPin.walletPin = newPin; // Hashing handled by pre-save hook
    await userWithPin.save();

    await Log.create({
        level: LOG_LEVELS.USER_ACTION,
        eventType: LOG_EVENT_TYPES.USER_PIN_CHANGED,
        message: `User ${user.email} changed their wallet PIN using OTP.`,
        user: user._id,
    });
    return { message: "Wallet PIN changed successfully." };
};

export const verifyUserPin = async (userId, pinToVerify) => {
    const user = await User.findById(userId).select('+walletPin');
    if (!user) throw new NotFoundError("User not found.");
    if (!user.walletPin) throw new BadRequestError("Wallet PIN not set for this user.");

    const isPinCorrect = await user.isWalletPinCorrect(pinToVerify);
    if (!isPinCorrect) {
        throw new BadRequestError("Incorrect wallet PIN.");
    }
    return true;
};


export const setPayoutWalletAddressService = async (userId, cryptoSymbol, address, pin) => {
    const user = await User.findById(userId).select('+walletPin');
    if (!user) throw new NotFoundError("User not found.");

    // Verify PIN first
    if (!user.walletPin) throw new BadRequestError("Wallet PIN not set. Please set your PIN first.");
    const isPinCorrect = await user.isWalletPinCorrect(pin);
    if (!isPinCorrect) throw new BadRequestError("Incorrect wallet PIN.");

    // For changing an existing address, OTP might be required in a separate step or integrated here.
    // The blueprint mentions OTP for changing, so this function is more for 'setting' an initial one
    // or updating if already verified by OTP.

    user.payoutWalletAddresses.set(cryptoSymbol.toUpperCase(), address);
    await user.save();

    await Log.create({
        level: LOG_LEVELS.USER_ACTION,
        eventType: LOG_EVENT_TYPES.USER_PAYOUT_WALLET_SET, // Or CHANGED if logic allows
        message: `User ${user.email} set/updated payout wallet for ${cryptoSymbol} to ${address}.`,
        user: user._id,
        details: { cryptoSymbol, address }
    });

    return { message: `Payout wallet for ${cryptoSymbol} set to ${address}.` };
};

export const verifyEmailWithOtp = async (email, otp) => {
    // await verifyOtp(email, otp, OTP_PURPOSES.EMAIL_VERIFICATION);

    // const user = await User.findOne({ email: email.toLowerCase() });
    // if (!user) throw new NotFoundError("User not found for this email."); // Should not happen if OTP was sent

    // if (user.isEmailVerified) throw new BadRequestError("Email is already verified.");

    // user.isEmailVerified = true;
    // user.status = ACCOUNT_STATUS.ACTIVE; // Activate account after email verification
    // user.emailVerificationToken = undefined; // Clear token fields
    // user.emailVerificationTokenExpires = undefined;
    // await user.save();

    // // Send welcome email now that email is verified
    // await sendWelcomeEmail(user.email, user.fullName);

    // await Log.create({
    //     level: LOG_LEVELS.USER_ACTION,
    //     eventType: LOG_EVENT_TYPES.USER_EMAIL_VERIFIED,
    //     message: `User ${user.email} verified their email.`,
    //     user: user._id,
    // });

    // return { message: "Email verified successfully. Your account is now active." };

    logger.info(`[User Service] verifyEmailWithOtp called for email: ${email}`);
    try {
        // Call the OTP service to verify the OTP.
        // This will throw an error if OTP is invalid/expired.
        const otpVerificationResult = await verifyOtp(email, otp, OTP_PURPOSES.EMAIL_VERIFICATION);

        // This part should ONLY execute if verifyOtp did NOT throw an error.
        // However, your log shows "OTP verified successfully" even before the error.
        // This implies the success log might be inside verifyOtp but before the actual successful return.

        // If verifyOtp above did not throw, then proceed:
        if (!otpVerificationResult || !otpVerificationResult.success) {
            // This case should ideally be handled by verifyOtp throwing an error itself
            logger.warn(`[User Service] OTP verification failed for ${email} but no error was thrown by otpService.verifyOtp. Result:`, otpVerificationResult);
            throw new BadRequestError("OTP verification failed.");
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            logger.error(`[User Service] User not found for email ${email} after successful OTP verification. This should not happen.`);
            throw new NotFoundError("User not found for this email.");
        }

        if (user.isEmailVerified) {
            // This is not an error, just info. User might be re-verifying.
            logger.info(`[User Service] Email ${email} is already verified.`);
            // return { message: "Email is already verified." }; // Or proceed to activate if status isn't active
        }

        user.isEmailVerified = true;
        user.status = ACCOUNT_STATUS.ACTIVE;
        user.emailVerificationToken = undefined;
        user.emailVerificationTokenExpires = undefined;
        await user.save();

        await createLogEntry(
            LOG_LEVELS.USER_ACTION,
            LOG_EVENT_TYPES.USER_EMAIL_VERIFIED, // Ensure this event type is in constants
            `User ${user.email} verified their email. Account activated.`,
            user._id,
            { email: user.email }
        );

        logger.info(`[User Service] Email ${email} verified successfully. Account for user ${user._id} is now active.`);
        return { message: "Email verified successfully. Your account is now active." };

    } catch (error) {
        // This catch block will catch errors thrown by otpService.verifyOtp
        logger.error(`[User Service] Error during email verification for ${email}:`, error.message);
        if (error instanceof ApiError) throw error; // Re-throw known API errors
        // Fallback for unexpected errors
        throw new ApiError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, "An error occurred during email verification process.");
    }
};


export const initiatePasswordReset = async (email) => {
    logger.info(`[User Service] Attempting to initiate password reset for email: ${email}`);
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
        // Don't reveal if the email exists or not for security reasons.
        // Log it for admin awareness but return a generic success-like message to the client.
        logger.warn(`[User Service] Password reset requested for non-existent email: ${email}`);
        return { message: "If your email is registered, a password reset link has been sent." };
    }

    // Generate a password reset token (using the method from User model for consistency)
    // The User model's generateVerificationToken method expects an OTP_PURPOSE
    // and stores a hashed token, returning the plain token/OTP for sending.
    // For password reset, we usually send a longer, more unique token, not just a 6-digit OTP.
    // Let's adjust the User model's method or create a specific one if needed.

    // Assuming User model's generateVerificationToken for PASSWORD_RESET generates a suitable token string
    // and stores its hash (e.g., passwordResetToken, passwordResetTokenExpires)

    const resetTokenString = crypto.randomBytes(32).toString('hex'); // A more secure token
    user.passwordResetToken = crypto.createHash('sha256').update(resetTokenString).digest('hex');
    user.passwordResetTokenExpires = Date.now() + 3600000; // 1 hour expiry (3600000 ms)

    await user.save({ validateBeforeSave: false }); // Skip validation if only updating token fields

    try {
        await sendPasswordResetEmail(user.email, resetTokenString); // Send the plain token
        logger.info(`[User Service] Password reset email sent to ${user.email}.`);
    } catch (emailError) {
        logger.error(`[User Service] Failed to send password reset email to ${user.email}:`, emailError);
        // Even if email fails, don't let user know the token generation failed internally.
        // The token is still set in DB; they could try again or contact support if email doesn't arrive.
        // Throwing an error here might reveal too much or block the flow unnecessarily if it's a transient email issue.
    }

    return { message: "If your email is registered, a password reset link has been sent." };
};

export const resetPasswordWithToken = async (token, newPassword) => {
    logger.info(`[User Service] Attempting to reset password with token.`);
    if (!token || !newPassword) {
        throw new BadRequestError("Token and new password are required.");
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetTokenExpires: { $gt: Date.now() },
    }).select('+password'); // Select password to allow updating it

    if (!user) {
        throw new BadRequestError("Password reset token is invalid or has expired.");
    }

    // Check if new password is same as old (optional but good practice)
    if (user.password) { // Only if password was previously set
        const isSamePassword = await user.isPasswordCorrect(newPassword);
        if (isSamePassword) {
            throw new BadRequestError("New password cannot be the same as the old password.");
        }
    }

    user.password = newPassword; // Hashing is handled by the pre-save hook in User model
    user.passwordResetToken = undefined; // Clear the token
    user.passwordResetTokenExpires = undefined; // Clear expiry
    // user.isEmailVerified = true; // Optionally re-verify email if needed, or ensure it was already verified
    // user.status = ACCOUNT_STATUS.ACTIVE; // Ensure account is active

    await user.save();

    // TODO: Log this action with createLogEntry
    // TODO: Send "Password has been changed" notification email to the user

    logger.info(`[User Service] Password reset successfully for user: ${user.email}`);
    return { message: "Password has been reset successfully." };
};

// Create getUserActivityLog
export const getUserActivityLog = async (userId) => {
    const logs = await Log.find({ user: userId }).sort({ createdAt: -1 });
    if (!logs || logs.length === 0) {
        throw new NotFoundError("No activity logs found for this user.");
    }
    return logs;
};

export const refreshUserAccessToken = async (token) => {
    if (!token) {
        throw new UnauthorizedError("Refresh token is required.");
    }

    let decoded;
    try {
        decoded = jwt.verify(token, config.jwt.refreshSecret);
    } catch (error) {
        logger.warn("Invalid refresh token during verification:", error.message);
        throw new UnauthorizedError("Invalid or expired refresh token.");
    }

    // Optional: If you store refresh tokens in DB to allow invalidation
    // const user = await User.findOne({ _id: decoded.userId, refreshToken: token });
    // For simplicity, if not storing in DB, just find by userId:
    const user = await User.findById(decoded.userId);

    if (!user) {
        throw new UnauthorizedError("User not found for this refresh token.");
    }
    // if (user.refreshToken !== token) { // If comparing against stored token
    //     throw new UnauthorizedError("Refresh token mismatch or revoked.");
    // }
    if (user.status !== ACCOUNT_STATUS.ACTIVE) {
        throw new ForbiddenError("User account is not active.");
    }

    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken(); // Generate a new one (good practice for rotation)

    // Optional: Update the new refresh token in the DB if you store them
    // user.refreshToken = newRefreshToken;
    // await user.save();

    return { newAccessToken, newRefreshToken, user };
};

export const getUserNotifications = async (userIdString, queryParams = {}) => {
    // Convert userIdString to ObjectId early
    let userObjectId;
    try {
        userObjectId = new mongoose.Types.ObjectId(userIdString);
    } catch (e) {
        logger.error(`[User Service - Notifications] Invalid userId format: ${userIdString}`);
        throw new NotFoundError("User not found for notifications (invalid ID format).");
    }

    const user = await User.findById(userObjectId).select('role').lean();
    if (!user) {
        logger.warn(`[User Service - Notifications] User not found in DB with ID: ${userIdString}`);
        throw new NotFoundError("User not found for notifications.");
    }

    // --- Logic for onlyUnreadCount ---
    if (queryParams.onlyUnreadCount === true || queryParams.onlyUnreadCount === 'true') {
        
        const unreadUserSpecificQuery = { user: userObjectId, isRead: false };
        const count = await Notification.countDocuments(unreadUserSpecificQuery);

        logger.info(`[User Service - Notifications] Unread count requested for user ${userIdString}. Count: ${count}`);
        return { unreadCount: count }; // Return only the count
    }

    // --- Full Notification Fetch Logic (your existing logic) ---
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = parseInt(queryParams.limit, 10) || DEFAULT_PAGINATION_LIMIT;
    const effectiveLimit = Math.min(limit, MAX_PAGINATION_LIMIT);
    const skip = (page - 1) * effectiveLimit;

    const query = {
        $or: [
            { user: userObjectId },
            {
                isBroadcast: true,
                $or: [
                    { targetRoles: { $size: 0 } },
                    { targetRoles: { $elemMatch: { $eq: user.role } } }
                ]
            }
        ]
    };

    logger.info(`[User Service - Notifications] Fetching full notifications for user ${userIdString}, page ${page}, limit ${limit}`);
    const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(effectiveLimit)
        .lean();

    const totalNotificationsInQuery = await Notification.countDocuments(query);

    
    const unreadCountForThisQuery = await Notification.countDocuments({
        user: userObjectId, // Specifically for this user
        isRead: false,
        $and: [query, { isRead: false }] 
    });
    // Simpler and more direct unread count for the list:
    const unreadForUserInList = await Notification.countDocuments({ user: userObjectId, isRead: false });


    logger.info(`[User Service - Notifications] Returning ${notifications.length} notifications for user ${userIdString}. Total matching query: ${totalNotificationsInQuery}. Unread for user: ${unreadForUserInList}`);
    return {
        notifications,
        totalPages: Math.ceil(totalNotificationsInQuery / effectiveLimit),
        currentPage: page,
        totalNotifications: totalNotificationsInQuery,
        unreadCount: unreadForUserInList // Or unreadCountForThisQuery depending on desired meaning
    };
};

export const markNotificationAsRead = async (userId, notificationId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const notificationObjectId = new mongoose.Types.ObjectId(notificationId);

    // Ensure the user has access to this notification before marking it read
    // (either it's theirs or a broadcast they can see)
    const notification = await Notification.findOne({
        _id: notificationObjectId,
        $or: [
            { user: userObjectId },
            { isBroadcast: true } // Simplification: allow marking any visible broadcast as read by user
            // More complex: check targetRoles again if needed, but if they see it, they can read it.
        ]
    });

    if (!notification) {
        throw new NotFoundError("Notification not found or access denied.");
    }

    if (notification.isRead) {
        return { message: "Notification already marked as read.", notification };
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save(); // Need to save the Mongoose document, so don't use .lean() in findOne

    return { message: "Notification marked as read.", notification };
};

export const markAllUserNotificationsAsRead = async (userId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(userObjectId).select('role').lean();

    if (!user) {
        throw new NotFoundError("User not found.");
    }

    // Construct the same query as in getUserNotifications to target relevant notifications
    const query = {
        isRead: false, // Only update unread ones
        $or: [
            { user: userObjectId },
            {
                isBroadcast: true,
                $or: [
                    { targetRoles: { $size: 0 } },
                    { targetRoles: { $elemMatch: { $eq: user.role } } }
                ]
            }
        ]
    };

    const updateResult = await Notification.updateMany(
        query,
        { $set: { isRead: true, readAt: new Date() } }
    );

    logger.info(`[User Service] Marked ${updateResult.modifiedCount} notifications as read for user ${userId}`);
    return { message: `${updateResult.modifiedCount} notifications marked as read.`, modifiedCount: updateResult.modifiedCount };
};

// TODO: Implement KYC submission service
// TODO: Implement 2FA setup service