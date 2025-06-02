// src/models/Transaction.model.js
import mongoose from 'mongoose';
import { TRANSACTION_TYPES, TRANSACTION_STATUS, SUPPORTED_CRYPTO_SYMBOLS } from '../constants/index.js';

const transactionSchema = new mongoose.Schema(
    {
        user: { // The user associated with this transaction
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: { // Type of transaction (Deposit, Withdrawal, ROI Payout, etc.)
            type: String,
            enum: Object.values(TRANSACTION_TYPES),
            required: true,
            index: true,
        },
        relatedInvestment: { // Link to an Investment if applicable (e.g., for deposit, ROI)
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Investment',
        },
        relatedWithdrawal: { // Link to a Withdrawal request if applicable
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Withdrawal',
        },
        amountUSD: { // The USD value of the transaction
            type: Number,
            required: true,
        },
        cryptocurrency: { // The cryptocurrency involved
            type: String,
            enum: SUPPORTED_CRYPTO_SYMBOLS,
            required: true,
        },
        amountCrypto: { // The amount in the specified cryptocurrency
            type: Number,
            // required: true, // May not be known initially for deposits until conversion
        },
        cryptoToUSDRate: { // The exchange rate at the time of the transaction
            type: Number,
        },
        platformTxid: { // For withdrawals: TXID of platform sending funds
            type: String,
            trim: true,
        },
        userTxid: { // For deposits: TXID provided by user
            type: String,
            trim: true,
        },
        platformWalletAddress: { // Platform's wallet involved
            type: String,
            trim: true,
        },
        userWalletAddress: { // User's wallet involved (e.g., payout address)
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: Object.values(TRANSACTION_STATUS),
            required: true,
            default: TRANSACTION_STATUS.PENDING,
            index: true,
        },
        description: { // A brief description or note about the transaction
            type: String,
            trim: true,
        },
        processedBy: { // Admin or System that processed/verified
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        completedAt: { // Timestamp when transaction reached final state (Completed/Failed/Rejected)
            type: Date,
        }
    },
    {
        timestamps: true, // createdAt will be the initiation time
    }
);

transactionSchema.index({ user: 1, type: 1, status: 1 });
transactionSchema.index({ type: 1, status: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;