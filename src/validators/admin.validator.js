// src/validators/admin.validator.js
import { body, param } from 'express-validator';
import { ACCOUNT_STATUS, KYC_STATUS, SUPPORTED_CRYPTO_SYMBOLS, USER_ROLES } from '../constants/index.js';

// --- Admin User Management Validators ---
export const adminUpdateUserStatusValidator = [
    body('status')
        .notEmpty().withMessage('Account status is required.')
        .isIn(Object.values(ACCOUNT_STATUS)).withMessage('Invalid account status provided.'),
    body('reason')
        .if(body('status').isIn([ACCOUNT_STATUS.SUSPENDED, ACCOUNT_STATUS.DEACTIVATED]))
        .notEmpty().withMessage('Reason is required for suspension or deactivation.')
        .trim()
        .isLength({ min: 5, max: 500 }).withMessage('Reason must be between 5 and 500 characters.'),
];

export const adminUpdateKycStatusValidator = [
    body('kycStatus')
        .notEmpty().withMessage('KYC status is required.')
        .isIn(Object.values(KYC_STATUS)).withMessage('Invalid KYC status provided.'),
    body('rejectionReason')
        .if(body('kycStatus').equals(KYC_STATUS.REJECTED))
        .notEmpty().withMessage('Rejection reason is required for KYC rejection.')
        .trim()
        .isLength({ min: 5, max: 500 }).withMessage('Rejection reason must be between 5 and 500 characters.'),
];

// --- Admin Investment Management Validators ---
export const adminCancelInvestmentValidator = [
    body('reason')
        .trim()
        .notEmpty().withMessage('Reason for cancellation is required.')
        .isLength({ min: 5, max: 500 }).withMessage('Reason must be between 5 and 500 characters.'),
];

// --- Admin Platform Settings Validators ---
export const addSupportedCryptoValidator = [
    body('name')
        .trim().notEmpty().withMessage('Cryptocurrency name is required.')
        .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters.'),
    body('symbol')
        .trim().notEmpty().withMessage('Cryptocurrency symbol is required.')
        .isUppercase().withMessage('Symbol must be uppercase.')
        .isIn(SUPPORTED_CRYPTO_SYMBOLS).withMessage('Symbol is not in the globally supported list or is invalid.')
        .isLength({ min: 2, max: 10 }).withMessage('Symbol must be between 2 and 10 characters.'),
    body('platformDepositWalletAddress')
        .trim().notEmpty().withMessage('Platform deposit wallet address is required.')
        .isLength({ min: 20, max: 150 }).withMessage('Wallet address seems invalid.'), // Basic check
    body('isActiveForInvestment')
        .optional().isBoolean().withMessage('isActiveForInvestment must be a boolean.'),
    body('isActiveForPayout')
        .optional().isBoolean().withMessage('isActiveForPayout must be a boolean.'),
    body('networkConfirmationThreshold')
        .optional({ checkFalsy: true })
        .isInt({ min: 1 }).withMessage('Network confirmation threshold must be a positive integer.'),
    body('displayOrder')
        .optional({ checkFalsy: true })
        .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer.'),
    body('iconUrl')
        .optional({ checkFalsy: true })
        .isURL().withMessage('Icon URL must be a valid URL.'),
];

export const updateSupportedCryptoValidator = [
    param('cryptoId').isMongoId().withMessage('Invalid Crypto ID format.'),
    body('name')
        .optional().trim().notEmpty().withMessage('Cryptocurrency name cannot be empty if provided.')
        .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters.'),
    // Symbol change is generally not recommended once set. If allowed, add validation.
    // body('symbol'). ...
    body('platformDepositWalletAddress')
        .optional().trim().notEmpty().withMessage('Platform deposit wallet address cannot be empty if provided.')
        .isLength({ min: 20, max: 150 }).withMessage('Wallet address seems invalid.'),
    body('isActiveForInvestment')
        .optional().isBoolean().withMessage('isActiveForInvestment must be a boolean.'),
    body('isActiveForPayout')
        .optional().isBoolean().withMessage('isActiveForPayout must be a boolean.'),
    body('networkConfirmationThreshold')
        .optional({ checkFalsy: true })
        .isInt({ min: 1 }).withMessage('Network confirmation threshold must be a positive integer.'),
    body('displayOrder')
        .optional({ checkFalsy: true })
        .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer.'),
    body('iconUrl')
        .optional({ checkFalsy: true })
        .isURL().withMessage('Icon URL must be a valid URL.'),
    body('notes')
        .optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters.')
];

export const broadcastAnnouncementValidator = [
    body('title')
        .trim().notEmpty().withMessage('Announcement title is required.')
        .isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters.'),
    body('message')
        .trim().notEmpty().withMessage('Announcement message is required.')
        .isLength({ min: 10, max: 2000 }).withMessage('Message must be between 10 and 2000 characters.'),
    body('targetRoles')
        .optional()
        .isArray().withMessage('targetRoles must be an array.')
        .custom((roles) => {
            if (!roles.every(role => Object.values(USER_ROLES).includes(role))) {
                throw new Error('Invalid target role specified.');
            }
            return true;
        }),
    // body('isEmergency').optional().isBoolean().withMessage('isEmergency must be a boolean.'), // If you add this field
];

export const adminVerifyInvestmentValidator = [
    // param('investmentId') is handled by investmentIdParamValidator, no need to repeat if used together
    body('transactionId') // The TXID the admin is confirming
        .trim()
        .notEmpty().withMessage('Confirmed blockchain Transaction ID (TXID) is required.')
        .isLength({ min: 10, max: 100 }).withMessage('Transaction ID seems invalid.'),
    body('actualCryptoAmountReceived')
        .notEmpty().withMessage('Actual crypto amount received is required.')
        .isFloat({ gt: 0 }).withMessage('Actual crypto amount received must be a positive number.'),
    body('adminNotes')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Admin notes cannot exceed 500 characters.')
];


export const notificationIdParamValidator = [
    param('notificationId')
        .isMongoId().withMessage('Invalid notification ID format.')
];