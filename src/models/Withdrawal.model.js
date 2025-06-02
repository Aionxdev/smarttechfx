// src/models/Withdrawal.model.js
import mongoose from 'mongoose';
import { WITHDRAWAL_STATUS, SUPPORTED_CRYPTO_SYMBOLS } from '../constants/index.js';

const withdrawalSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        investment: { // Optional: If withdrawal is directly tied to a specific matured investment
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Investment',
        },
        amountUSD: { // The USD equivalent amount requested for withdrawal
            type: Number,
            required: [true, "Withdrawal amount in USD is required"],
            min: [0.01, "Withdrawal amount must be positive"],
        },
        cryptocurrency: { // The cryptocurrency for payout
            type: String,
            required: [true, "Payout cryptocurrency is required"],
            enum: SUPPORTED_CRYPTO_SYMBOLS,
        },
        // Calculated amount in payout crypto at the time of processing/approval
        amountCrypto: { type: Number },
        cryptoToUSDRateSnapshot: { type: Number }, // Rate at time of processing

        userPayoutWalletAddress: { // The user's wallet address for this withdrawal
            type: String,
            required: [true, "User payout wallet address is required"],
            trim: true,
        },
        requestDate: {
            type: Date,
            default: Date.now,
            index: true,
        },
        status: {
            type: String,
            enum: Object.values(WITHDRAWAL_STATUS),
            default: WITHDRAWAL_STATUS.PENDING,
            index: true,
        },
        // Admin approval details
        approvalDate: { type: Date },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin User

        // Processing details (when platform sends the crypto)
        processingDate: { type: Date },
        processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin User or System
        platformTransactionId: { type: String, trim: true }, // TXID of the payout from platform to user

        completionDate: { type: Date }, // When confirmed completed

        rejectionReason: { type: String, trim: true }, // If rejected by admin
        cancellationReason: { type: String, trim: true }, // If cancelled by user/system

        adminNotes: { type: String, trim: true },
    },
    {
        timestamps: true,
    }
);

withdrawalSchema.index({ user: 1, status: 1 });
withdrawalSchema.index({ status: 1, requestDate: -1 }); // For admin panel to see pending requests

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
export default Withdrawal;