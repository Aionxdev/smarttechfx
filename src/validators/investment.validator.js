// src/validators/investment.validator.js
import { body, param } from 'express-validator';
import { SUPPORTED_CRYPTO_SYMBOLS } from '../constants/index.js';
import InvestmentPlan from '../models/InvestmentPlan.model.js'; // For custom validation

export const createInvestmentValidator = [
    body('planId')
        .notEmpty().withMessage('Investment plan ID is required.')
        .isMongoId().withMessage('Invalid investment plan ID format.'),
    body('investedAmountUSD')
        .notEmpty().withMessage('Investment amount in USD is required.')
        .isFloat({ min: 1 }).withMessage('Investment amount must be a positive number.'),
    // Custom validation to check against plan's min/max USD could be added here
    // custom(async (value, { req }) => {
    //     const plan = await InvestmentPlan.findById(req.body.planId);
    //     if (!plan) return Promise.reject('Investment plan not found.');
    //     if (value < plan.investmentRange.minUSD || value > plan.investmentRange.maxUSD) {
    //         return Promise.reject(`Amount must be between $${plan.investmentRange.minUSD} and $${plan.investmentRange.maxUSD} for this plan.`);
    //     }
    // }),
    body('paymentCryptocurrency')
        .notEmpty().withMessage('Payment cryptocurrency is required.')
        .isIn(SUPPORTED_CRYPTO_SYMBOLS).withMessage('Invalid or unsupported payment cryptocurrency.'),
    body('transactionId') // User-provided TXID for their deposit
        .optional({ checkFalsy: true }) // Might be provided later or not at all if platform scans for deposits
        .trim()
        .isLength({ min: 10, max: 100 }).withMessage('Transaction ID seems invalid.'),
    body('isReinvestEnabled')
        .optional()
        .isBoolean().withMessage('Reinvestment option must be a boolean.'),
];

export const verifyInvestmentTxidValidator = [
    param('investmentId')
        .notEmpty().withMessage('Investment ID is required.')
        .isMongoId().withMessage('Invalid Investment ID format.'),
    body('transactionId')
        .trim()
        .notEmpty().withMessage('Transaction ID (TXID) is required for verification.')
        .isLength({ min: 10, max: 100 }).withMessage('Transaction ID seems invalid.'),
    body('platformReceivingWalletAddress') // The address user was TOLD to send to
        .trim()
        .notEmpty().withMessage('Platform receiving wallet address is required.')
        .isLength({ min: 20, max: 150 }).withMessage('Wallet address seems invalid.'),
    body('paymentAmountCrypto')
        .notEmpty().withMessage('Actual crypto amount received is required.')
        .isFloat({ gt: 0 }).withMessage('Crypto amount must be a positive number.'),
    body('adminNotes')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Admin notes cannot exceed 500 characters.'),
];

export const investmentIdParamValidator = [
    param('investmentId')
        .notEmpty().withMessage('Investment ID is required.')
        .isMongoId().withMessage('Invalid Investment ID format.'),
];


export const submitTxidValidator = [
    param('investmentId')
        .notEmpty().withMessage('Investment ID is required.')
        .isMongoId().withMessage('Invalid Investment ID format.'),
    body('transactionId')
        .trim()
        .notEmpty().withMessage('Transaction ID (TXID) is required.')
        .isLength({ min: 10, max: 100 }).withMessage('Transaction ID seems invalid. It should typically be 64 hexadecimal characters for many blockchains, but length can vary.')
];
