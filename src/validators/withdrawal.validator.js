// src/validators/withdrawal.validator.js
import { body, param } from 'express-validator';
import { SUPPORTED_CRYPTO_SYMBOLS } from '../constants/index.js';

export const requestWithdrawalValidator = [
    body('amountUSD')
        .notEmpty().withMessage('Withdrawal amount in USD is required.')
        .isFloat({ gt: 0 }).withMessage('Withdrawal amount must be a positive number.'),
    // Add custom validation for min/max withdrawal limits, user balance check later
    body('cryptocurrency')
        .notEmpty().withMessage('Payout cryptocurrency is required.')
        .isIn(SUPPORTED_CRYPTO_SYMBOLS).withMessage('Invalid or unsupported payout cryptocurrency.'),
    // body('userPayoutWalletAddress') // This should ideally be pre-filled from user's profile
    //     .trim()
    //     .notEmpty().withMessage('Payout wallet address is required.')
    //     .isLength({ min: 20, max: 150 }).withMessage('Payout wallet address seems invalid.'),
    body('pin') // Wallet PIN for withdrawal authorization
        .notEmpty().withMessage('Wallet PIN is required for withdrawal.')
        .isNumeric().withMessage('PIN must be numeric.')
        .isLength({ min: 4, max: 6 }).withMessage('PIN must be between 4 and 6 digits.'),
];

export const adminApproveWithdrawalValidator = [
    param('withdrawalId')
        .notEmpty().withMessage('Withdrawal ID is required.')
        .isMongoId().withMessage('Invalid Withdrawal ID format.'),
    body('platformTransactionId') // TXID of the payout from platform to user
        .trim()
        .notEmpty().withMessage('Platform transaction ID (TXID) is required for approval.')
        .isLength({ min: 10, max: 100 }).withMessage('Platform transaction ID seems invalid.'),
    body('adminNotes')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Admin notes cannot exceed 500 characters.'),
];

export const adminRejectWithdrawalValidator = [
    param('withdrawalId')
        .notEmpty().withMessage('Withdrawal ID is required.')
        .isMongoId().withMessage('Invalid Withdrawal ID format.'),
    body('rejectionReason')
        .trim()
        .notEmpty().withMessage('Rejection reason is required.')
        .isLength({ min: 10, max: 500 }).withMessage('Rejection reason must be between 10 and 500 characters.'),
];

export const withdrawalIdParamValidator = [
    param('withdrawalId')
        .notEmpty().withMessage('Withdrawal ID is required.')
        .isMongoId().withMessage('Invalid Withdrawal ID format.'),
];