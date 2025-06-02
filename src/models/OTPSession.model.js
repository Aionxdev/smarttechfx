// src/models/OTPSession.model.js
import mongoose from 'mongoose';
import crypto from 'crypto';
import { OTP_PURPOSES } from '../constants/index.js';
import config from '../config/index.js';
import logger from '../utils/logger.util.js'; // Import logger
import { HTTP_STATUS_CODES } from '../constants/index.js'; // Import HTTP status codes

const otpSessionSchema = new mongoose.Schema(
    {
        identifier: { // Could be email, phone number, or userID depending on OTP context
            type: String,
            required: true,
            index: true,
        },
        otp: { // The hashed OTP
            type: String,
            required: true,
        },
        purpose: {
            type: String,
            enum: Object.values(OTP_PURPOSES),
            required: true,
            index: true,
        },
        attempts: {
            type: Number,
            default: 0,
        },
        isVerified: { // Whether this specific OTP instance was successfully verified
            type: Boolean,
            default: false,
        },
        expiresAt: {
            type: Date,
            required: true,
            // TTL index: MongoDB will automatically delete documents after this time
            // The value of 'expireAfterSeconds' must be 0 for this to work with a date field
            index: { expires: '0s' },
        },
    },
    {
        timestamps: true, // createdAt for when OTP was generated
    }
);

// Compound index for querying OTPs
otpSessionSchema.index({ identifier: 1, purpose: 1, isVerified: 1 });

// Helper to hash OTP before saving (though OTPs are short, hashing adds a layer)
otpSessionSchema.statics.hashOtp = function (otp) {
    return crypto.createHash('sha256').update(otp.toString()).digest('hex');
};

// Method to check if an OTP is correct
otpSessionSchema.methods.isOtpCorrect = function (candidateOtp) {
    const hashedCandidate = crypto.createHash('sha256').update(candidateOtp.toString()).digest('hex');
    return this.otp === hashedCandidate;
};

// Static method to create and save an OTP session
otpSessionSchema.statics.generate = async function (identifier, purpose) {
    logger.info(`[OTPSession Model] Attempting to generate OTP for identifier: ${identifier}, purpose: ${purpose}`); // <<< NEW LOG
    const plainOtp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const hashedOtp = this.hashOtp(plainOtp);
    // const expiryMinutes = config.otp.expiryMinutes || 10;
    // const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const expiryMinutes = parseInt(config.otp.expiryMinutes, 10); // Make sure it's parsed as int
    if (isNaN(expiryMinutes) || expiryMinutes <= 0) {
        logger.warn(`[OTPSession Model] Invalid OTP_EXPIRY_MINUTES configured (${config.otp.expiryMinutes}). Defaulting to 10 minutes.`);
        expiryMinutes = 10; // Fallback to a sane default
    }
    logger.info(`[OTPSession Model] Using expiryMinutes: ${expiryMinutes}`); // Log the actual minutes being used
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // // Invalidate previous active OTPs for the same identifier and purpose
    // await this.updateMany(
    //     { identifier, purpose, isVerified: false, expiresAt: { $gt: new Date() } },
    //     { $set: { expiresAt: new Date() } } // Expire them immediately
    // );

    // const otpSession = await this.create({
    //     identifier,
    //     otp: hashedOtp,
    //     purpose,
    //     expiresAt,
    // });

    try {
        // Invalidate previous active OTPs for the same identifier and purpose
        const updateResult = await this.updateMany(
            { 
                identifier, 
                purpose, 
                isVerified: false, 
                expiresAt: { $gt: new Date() } 
            },
            { $set: { expiresAt: new Date(0) } } // Expire them immediately by setting to past
        );
        logger.info(`[OTPSession Model] Invalidated ${updateResult.modifiedCount} previous OTPs for ${identifier}, ${purpose}.`);

        logger.info(`[OTPSession Model] Creating OTP session with: id=${identifier}, pur=${purpose}, exp=${expiresAt}, otpHash=${hashedOtp.substring(0, 10)}...`); // <<< NEW LOG

        const otpSessionDoc = await this.create({ // 'this' refers to the OTPSession model
            identifier,
            otp: hashedOtp,
            purpose,
            expiresAt,
            attempts: 0,      // Ensure attempts is initialized
            isVerified: false // Ensure isVerified is initialized
        });

        // IMPORTANT: Check if otpSession was actually created and has an _id
        // if (otpSession && otpSession._id) {
        //     logger.info(`[OTPSession Model] Successfully created OTP session in DB. ID: ${otpSession._id}, Identifier: ${identifier}`); // <<< NEW LOG
        // } else {
        //     logger.error(`[OTPSession Model] CRITICAL: OTP session object was falsy or had no _id after create for identifier: ${identifier}. Session:`, otpSession); // <<< NEW LOG
        //     // This indicates a major issue with the create operation.
        //     return { otpSession: null, plainOtp }; // Return null session if creation failed
        // }

        if (!otpSessionDoc || !otpSessionDoc._id) {
            logger.error(`[OTPSession Model] FAILED to create OTP session in DB for ${identifier}. otpSessionDoc is null or has no _id.`);
            return { otpSession: null, plainOtp }; // CRITICAL: Indicate failure
        }
        logger.info(`[OTPSession Model] Successfully created OTP session in DB. ID: ${otpSessionDoc._id}`);
        return { otpSession: otpSessionDoc, plainOtp };
    } catch (dbError) {
        logger.error(`[OTPSession Model] DB EXCEPTION during OTP session creation for ${identifier}:`, dbError);

    return { otpSession, plainOtp }; // Return plain OTP to send to user, and session for DB ops
    }

    // catch (error) {
    //     logger.error(`[OTPSession Model] Error generating OTP session: ${error.message}`); // <<< NEW LOG
    //     throw new Error('Error generating OTP session');
    // }
};


const OTPSession = mongoose.model('OTPSession', otpSessionSchema);
export default OTPSession;