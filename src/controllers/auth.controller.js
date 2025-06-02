// src/controllers/auth.controller.js
import {
    userService,
    otpService,
    // emailService will be called by otpService or userService
} from '../services/index.js';
import { ApiResponse, sendSuccessResponse } from '../utils/apiResponse.util.js';
import ApiError, { BadRequestError, UnauthorizedError } from '../utils/apiError.util.js';
import { HTTP_STATUS_CODES, OTP_PURPOSES } from '../constants/index.js';
import config from '../config/index.js';
import { pick } from '../utils/index.js';
import logger from '../utils/logger.util.js';

export const register = async (req, res) => {
    const userData = pick(req.body, ['fullName', 'email', 'password', 'phoneNumber', 'country', 'preferredCrypto']);
    const ipAddress = req.ip;

    const newUser = await userService.registerUser(userData, ipAddress);

    // Don't send tokens on registration; user needs to verify email then login
    return sendSuccessResponse(
        res,
        HTTP_STATUS_CODES.CREATED,
        { userId: newUser._id, email: newUser.email }, // Send minimal info
        "Registration successful. Please check your email to verify your account."
    );
};

export const login = async (req, res) => {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const { user, accessToken, refreshToken } = await userService.loginUser(email, password, ipAddress, userAgent);

    const cookieOptions = {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'strict', // Or 'lax' if needed for cross-site scenarios (be careful)
    };

    res.cookie(config.jwt.cookieName, accessToken, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 }); // e.g., 1 day
    res.cookie(config.jwt.refreshCookieName, refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); // e.g., 7 days

    return sendSuccessResponse(
        res,
        HTTP_STATUS_CODES.OK,
        { user: pick(user, ['_id', 'fullName', 'email', 'role', 'isEmailVerified', 'kycStatus', 'twoFactorEnabled']) },
        "Login successful."
    );
};

export const logout = async (req, res) => {
    // For JWT in cookies, logout means clearing the cookies.
    // If storing refresh tokens in DB, you might also want to invalidate it.
    // const userId = req.user?._id; // Assuming verifyJWT middleware populates req.user
    // if (userId) {
    //    await userService.clearRefreshToken(userId); // Example service method
    // }

    res.clearCookie(config.jwt.cookieName, { httpOnly: true, secure: config.env === 'production', sameSite: 'strict' });
    res.clearCookie(config.jwt.refreshCookieName, { httpOnly: true, secure: config.env === 'production', sameSite: 'strict' });

    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, null, "Logged out successfully.");
};

// export const refreshAccessToken = async (req, res) => {
//     const incomingRefreshToken = req.cookies?.[config.jwt.refreshCookieName];
//     if (!incomingRefreshToken) {
//         throw new UnauthorizedError("Refresh token not found.");
//     }

//     // This service method would verify the refresh token and issue a new access token
//     // It needs to be created in userService or a dedicated tokenService
//     // const { newAccessToken, user } = await userService.refreshUserAccessToken(incomingRefreshToken);

//     // Placeholder for the actual service call:
//     // Simulating token refresh logic (replace with actual service that verifies RT and gets user)
//     let decodedRefreshToken;
//     try {
//         decodedRefreshToken = jwt.verify(incomingRefreshToken, config.jwt.refreshSecret);
//     } catch (error) {
//         throw new UnauthorizedError("Invalid or expired refresh token.");
//     }
//     const user = await userService.findUserById(decodedRefreshToken.userId);
//     if (!user) throw new UnauthorizedError("User associated with refresh token not found.");

//     const newAccessToken = user.generateAccessToken();
//     // End Placeholder

//     const cookieOptions = {
//         httpOnly: true,
//         secure: config.env === 'production',
//         sameSite: 'strict',
//     };
//     res.cookie(config.jwt.cookieName, newAccessToken, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 });

//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, { /* Optionally send some non-sensitive user info */ }, "Access token refreshed.");
// };

export const sendOtp = async (req, res) => {
    const { email, purpose } = req.body;
    // For purposes like PIN_CHANGE, WALLET_ADDRESS_CHANGE, ensure user is authenticated
    // if ([OTP_PURPOSES.PIN_CHANGE, OTP_PURPOSES.WALLET_ADDRESS_CHANGE].includes(purpose) && !req.user) {
    //     throw new UnauthorizedError("Authentication required for this action.");
    // }
    // if (req.user && req.user.email !== email && purpose !== OTP_PURPOSES.EMAIL_VERIFICATION && purpose !== OTP_PURPOSES.PASSWORD_RESET){
    //      throw new ForbiddenError("Cannot request OTP for another user's email.");
    // }

    const result = await otpService.generateAndSendOtp(email, purpose);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, result, result.message || "OTP sent successfully if your email is registered.");
};


export const verifyOtpController = async (req, res) => {
    const { email, otp, purpose } = req.body;

    let result;
    let message;

    if (purpose === OTP_PURPOSES.EMAIL_VERIFICATION) {
        // For email verification, userService.verifyEmailWithOtp handles OTP check AND user update
        logger.info(`[Auth Controller] verifyOtpController: Purpose is EMAIL_VERIFICATION. Calling userService.verifyEmailWithOtp for ${email}.`);
        result = await userService.verifyEmailWithOtp(email, otp); // This internally calls otpService.verifyOtp once
        message = result.message; // Get message from userService's result
    } else {
        // For other OTP purposes (e.g., PIN change, Wallet change AFTER initial verification)
        logger.info(`[Auth Controller] verifyOtpController: Purpose is ${purpose}. Calling otpService.verifyOtp for ${email}.`);
        result = await otpService.verifyOtp(email, otp, purpose);
        message = result.message || "OTP verified successfully."; // Get message from otpService's result
    }

    // The 'result' from either service should already indicate success/failure or throw an error.
    // sendSuccessResponse will be called if no error is thrown.
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, null, message);
};


export const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    // Call the service method
    const result = await userService.initiatePasswordReset(email);
    // The service method returns a generic message to prevent email enumeration
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, null, result.message);
};

export const performPasswordReset = async (req, res) => {
    const { token, newPassword } = req.body;
    // Call the service method
    const result = await userService.resetPasswordWithToken(token, newPassword);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, null, result.message);
};

// export const getCurrentAuthenticatedUser = async (req, res) => {
//     // req.user is populated by verifyJWT middleware
//     if (!req.user || !req.user.userId) {
//         throw new UnauthorizedError("Not authenticated.");
//     }
//     const user = await userService.findUserById(req.user.userId, '-password -walletPin -refreshToken -__v'); // Exclude sensitive fields
//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, user, "Current user data fetched successfully.");
// };


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


// src/controllers/auth.controller.js (Backend)
export const refreshAccessToken = async (req, res) => {
    const incomingRefreshToken = req.cookies?.[config.jwt.refreshCookieName]; // Reading from HttpOnly cookie

    if (!incomingRefreshToken) {
        logger.warn('[Auth Controller] Refresh token not found in cookies.');
        throw new UnauthorizedError("Refresh token not found."); // Send 401
    }

    try {
        // This service method verifies the refresh token and issues new tokens
        const { newAccessToken, newRefreshToken, user } = await userService.refreshUserAccessToken(incomingRefreshToken);

        const cookieOptions = { /* ... your httpOnly, secure, sameSite options ... */ };
        res.cookie(config.jwt.cookieName, newAccessToken, { ...cookieOptions, maxAge: config.jwt.expiresInMs }); // Example: expiresInMs
        res.cookie(config.jwt.refreshCookieName, newRefreshToken, { ...cookieOptions, maxAge: config.jwt.refreshExpiresInMs }); // Set new refresh token

        return sendSuccessResponse(res, HTTP_STATUS_CODES.OK,
            { user: pick(user, ['_id', 'email', 'role']) }, // Send minimal user info if needed
            "Access token refreshed successfully."
        );
    } catch (error) {
        logger.error('[Auth Controller] Token refresh failed:', error.message);
        // If refresh token is invalid/expired, service should throw UnauthorizedError
        // Clear cookies if refresh token is definitively invalid
        if (error instanceof UnauthorizedError) {
             res.clearCookie(config.jwt.cookieName, cookieOptions);
             res.clearCookie(config.jwt.refreshCookieName, cookieOptions);
        }
        throw error; // Re-throw to global error handler (will become 401 or other)
    }
};