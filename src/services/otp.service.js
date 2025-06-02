// src/services/otp.service.js
import { OTPSession, User } from '../models/index.js'; // User model for checking existence
import ApiError, { NotFoundError, BadRequestError, TooManyRequestsError, UnprocessableEntityError } from '../utils/apiError.util.js';
import { HTTP_STATUS_CODES, OTP_PURPOSES } from '../constants/index.js';
import config from '../config/index.js';
import logger from '../utils/logger.util.js';
import { sendOtpEmail } from './email.service.js';

const getPurposeDescription = (purpose) => {
    switch (purpose) {
        case OTP_PURPOSES.EMAIL_VERIFICATION: return "Email Verification";
        case OTP_PURPOSES.PASSWORD_RESET: return "Password Reset";
        case OTP_PURPOSES.PIN_CHANGE: return "PIN Change";
        case OTP_PURPOSES.WALLET_ADDRESS_SET: return "Set Payout Wallet";
        case OTP_PURPOSES.WALLET_ADDRESS_CHANGE: return "Change Payout Wallet";
        case OTP_PURPOSES.TWO_FACTOR_SETUP: return "Two-Factor Authentication Setup";
        case OTP_PURPOSES.TRANSACTION_CONFIRMATION: return "Transaction Confirmation";
        default: return "Security Verification";
    }
};

export const generateAndSendOtp = async (identifier, purpose, userId = null) => {
    // Check if user exists for certain purposes if identifier is email
    if (purpose === OTP_PURPOSES.PASSWORD_RESET || purpose === OTP_PURPOSES.PIN_CHANGE) {
        const userExists = await User.findOne({ email: identifier });
        if (!userExists) {
            // Don't reveal if email exists for security, just log and pretend to send
            logger.warn(`OTP request for non-existent user email ${identifier} for purpose ${purpose}.`);
            return true; // Return true to not leak info, but no email is sent.
        }
    }

    try {
        const { plainOtp, otpSession } = await OTPSession.generate(identifier, purpose);
        if (!otpSession) {
            throw new ApiError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, "Failed to generate OTP session.");
        }

        
        
        const purposeDescription = getPurposeDescription(purpose);
        const emailSent = await sendOtpEmail(identifier, plainOtp, purposeDescription);

        if (!emailSent) {
            logger.error(`Failed to send OTP email to ${identifier} for purpose ${purposeDescription}`);
            // If email fails, we might want to invalidate the OTP session to prevent unusable OTPs
            await OTPSession.findByIdAndDelete(otpSession._id);
            throw new UnprocessableEntityError("Failed to send OTP email. Please try again or check your email address.");
        }

        if (!otpSession || !otpSession._id) { // <<< THIS CHECK IS VITAL
            logger.error(`[OTP Service] OTP DB session generation failed for ${identifier}, purpose ${purpose}. Cannot send email.`);
            throw new ApiError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, "System error: Could not save OTP session.");
        }

        logger.info(`OTP (${plainOtp}) generated and sent to ${identifier} for purpose ${purposeDescription}`);
        return { success: true, message: `OTP sent to ${identifier} for ${purposeDescription}.` };

    } catch (error) {
        logger.error(`Error in generateAndSendOtp for ${identifier}, purpose ${purpose}:`, error);
        if (error instanceof ApiError) throw error;
        throw new ApiError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, "An error occurred while generating or sending OTP.");
    }
};

// export const verifyOtp = async (identifier, otp, purpose) => {
//     try {
//         const otpSession = await OTPSession.findOne({
//             identifier,
//             purpose,
//             isVerified: false,
//             expiresAt: { $gt: new Date() },
//         }).sort({ createdAt: -1 });

//         if (!otpSession) {
//             throw new BadRequestError("Invalid or expired OTP. Please request a new one.");
//         }

//         if (otpSession.attempts >= (config.otp.maxAttempts || 5)) {
//             otpSession.expiresAt = new Date(0); // Expire it immediately
//             await otpSession.save();
//             throw new TooManyRequestsError("Too many OTP attempts. This OTP is now invalid. Please request a new one.");
//         }

//     //     const isCorrect = otpSession.isOtpCorrect(otp);
//     //     if (!isCorrect) {
//     //         otpSession.attempts += 1;
//     //         await otpSession.save();
//     //         const attemptsLeft = (config.otp.maxAttempts || 5) - otpSession.attempts;
//     //         throw new BadRequestError(`Invalid OTP. ${attemptsLeft > 0 ? `${attemptsLeft} attempts remaining.` : 'No attempts left.'}`);
//     //     }

//     //     otpSession.isVerified = true;
//     //     otpSession.expiresAt = new Date(0); // Consume the OTP by expiring it
//     //     await otpSession.save();

//     //     logger.info(`OTP verified successfully for ${identifier}, purpose ${getPurposeDescription(purpose)}`);
//     //     return { success: true, message: "OTP verified successfully." };

//     // } catch (error) {
//     //     logger.error(`Error in verifyOtp for ${identifier}, purpose ${purpose}:`, error);
//     //     if (error instanceof ApiError) throw error;
//     //     throw new ApiError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, "An error occurred while verifying OTP.");
//     // }

//         // CORRECTED LOG PLACEMENT:
//         const isCorrect = otpSession.isOtpCorrect(otp);
//         if (!isCorrect) {
//             otpSession.attempts += 1;
//             await otpSession.save();
//             const attemptsLeft = (config.otp.maxAttempts || 5) - otpSession.attempts;
//             throw new BadRequestError(`Invalid OTP. ${attemptsLeft > 0 ? `${attemptsLeft} attempts remaining.` : 'No attempts left.'}`);
//         }

//         otpSession.isVerified = true;
//         otpSession.expiresAt = new Date(0); // Effectively consume the OTP by expiring it
//         await otpSession.save();

//         // Log success ONLY AFTER all checks pass and session is updated
//         logger.info(`[OTP Service] OTP verified successfully for ${identifier}, purpose ${getPurposeDescription(purpose)}`);
//         return { success: true, message: "OTP verified successfully." };


//     } catch (error) {
//         // The error log you are seeing is generated here
//         logger.error(`[OTP Service] Error in verifyOtp for ${identifier}, purpose ${purpose}:`, { message: error.message, name: error.name, stack: error.stack });
//         if (error instanceof ApiError) throw error;
//         // Avoid creating a new generic ApiError if it's already one we want to propagate
//         throw new ApiError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, "An error occurred while verifying OTP.");
//     }
// };

// src/services/otp.service.js
export const verifyOtp = async (identifier, otp, purpose) => {
    logger.info(`[OTP Service] verifyOtp called for id: ${identifier}, otp: ${otp}, pur: ${purpose}`);
    try {
        const otpSession = await OTPSession.findOne({
            identifier,
            purpose,
            isVerified: false,
            expiresAt: { $gt: new Date() }, // Check if expiresAt is in the future
        }).sort({ createdAt: -1 });

        // Log immediately after the findOne query
        logger.info(`[OTP Service] Searched for OTP session for findOne({ id: '${identifier}', pur: '${purpose}', isVer: false, expAt: { $gt: NOW } }). Found: ${otpSession ? otpSession._id : 'null'}`);
        logger.info(`[OTP Service] Current Date for expiry check: ${new Date().toISOString()}`);
        if (otpSession) {
            logger.info(`[OTP Service] Found session expiresAt: ${otpSession.expiresAt.toISOString()}`);
        }


        if (!otpSession) {
            throw new BadRequestError("Invalid or expired OTP. Please request a new one.");
        }

        if (otpSession.attempts >= (config.otp.maxAttempts || 5)) {
            otpSession.expiresAt = new Date(0);
            await otpSession.save();
            throw new TooManyRequestsError("Too many OTP attempts. This OTP is now invalid. Please request a new one.");
        }

        const isCorrect = otpSession.isOtpCorrect(otp); // Assumes this method exists on the model
        if (!isCorrect) {
            otpSession.attempts += 1;
            await otpSession.save();
            const attemptsLeft = (config.otp.maxAttempts || 5) - otpSession.attempts;
            throw new BadRequestError(`Invalid OTP. ${attemptsLeft > 0 ? `${attemptsLeft} attempts remaining.` : 'No attempts left.'}`);
        }

        // If all checks pass, then update and log success
        otpSession.isVerified = true;
        otpSession.expiresAt = new Date(0); // Effectively consume the OTP by expiring it
        await otpSession.save();

        // SUCCESS LOG MOVED HERE - ONLY LOG AFTER ALL CHECKS AND SAVE
        logger.info(`[OTP Service] OTP verified successfully for ${identifier}, purpose ${getPurposeDescription(purpose)}. Session ID: ${otpSession._id}`);
        return { success: true, message: "OTP verified successfully." };

    } catch (error) {
        logger.error(`[OTP Service] Error in verifyOtp for ${identifier}, purpose ${purpose}:`, { message: error.message, name: error.name, stack: error.stack });
        if (error instanceof ApiError) throw error;
        throw new ApiError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, "An error occurred while verifying OTP.");
    }
};