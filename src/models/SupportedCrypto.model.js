// src/models/SupportedCrypto.model.js
import mongoose from 'mongoose';
import { SUPPORTED_CRYPTO_SYMBOLS } from '../constants/index.js'; // For enum validation

const supportedCryptoSchema = new mongoose.Schema(
    {
        name: { // e.g., "Bitcoin"
            type: String,
            required: [true, "Cryptocurrency name is required"],
            trim: true,
            unique: true,
        },
        symbol: { // e.g., "BTC"
            type: String,
            required: [true, "Cryptocurrency symbol is required"],
            trim: true,
            uppercase: true,
            unique: true,
            enum: SUPPORTED_CRYPTO_SYMBOLS, // Ensure it's one of the hardcoded known symbols for consistency
        },
        platformDepositWalletAddress: { // The platform's master wallet address for users to send this crypto to
            type: String,
            required: [true, "Platform deposit wallet address is required"],
            trim: true,
            // Add validation for address format per crypto if possible
        },
        isActiveForInvestment: { // Can users invest using this crypto?
            type: Boolean,
            default: true,
            index: true,
        },
        isActiveForPayout: { // Can users receive payouts in this crypto?
            type: Boolean,
            default: true,
            index: true,
        },
        minInvestmentAmountCrypto: { // Optional: min amount of this specific crypto for an investment
            type: Number,
            default: 0,
        },
        minWithdrawalAmountCrypto: { // Optional: min amount of this specific crypto for a withdrawal
            type: Number,
            default: 0,
        },
        withdrawalFeePercentage: { // Optional: fee for withdrawing this crypto
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        withdrawalFeeFixedCrypto: { // Optional: fixed fee for withdrawing this crypto
            type: Number,
            default: 0,
            min: 0,
        },
        networkConfirmationThreshold: { // For deposits, e.g., BTC needs 3 confirmations
            type: Number,
            integer: true,
            min: 1,
        },
        displayOrder: { // For sorting in frontend dropdowns
            type: Number,
            default: 0,
        },
        iconUrl: { // URL to the coin's icon
            type: String,
            trim: true,
        },
        notes: { // Admin notes
            type: String,
            trim: true,
        }
    },
    {
        timestamps: true,
    }
);

// supportedCryptoSchema.index({ symbol: 1 });
supportedCryptoSchema.index({ isActiveForInvestment: 1, displayOrder: 1 });
supportedCryptoSchema.index({ isActiveForPayout: 1, displayOrder: 1 });


const SupportedCrypto = mongoose.model('SupportedCrypto', supportedCryptoSchema);
export default SupportedCrypto;