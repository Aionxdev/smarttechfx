// src/validators/user.validator.js
import { body, param } from 'express-validator';
import { SUPPORTED_CRYPTO_SYMBOLS } from '../constants/index.js';
// import User from '../models/User.model.js'; // For custom validation

export const updateUserProfileValidator = [
    body('fullName')
        .optional()
        .trim()
        .notEmpty().withMessage('Full name cannot be empty if provided.')
        .isLength({ min: 3, max: 100 }).withMessage('Full name must be between 3 and 100 characters.'),
    body('phoneNumber')
        .optional({ checkFalsy: true })
        .trim()
        .isMobilePhone('any', { strictMode: false }).withMessage('Invalid phone number format.'),
    body('country')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('Country name seems invalid.'),
    body('preferredCrypto')
        .optional({ checkFalsy: true })
        .isIn(SUPPORTED_CRYPTO_SYMBOLS).withMessage('Invalid preferred cryptocurrency selected.'),
    // Email is usually not updatable or requires a special verification process
];

export const setWalletPinValidator = [
    body('pin')
        .notEmpty().withMessage('PIN is required.')
        .isLength({ min: 4, max: 6 }).withMessage('PIN must be between 4 and 6 digits.')
        .isNumeric().withMessage('PIN must be numeric.'),
    body('confirmPin')
        .notEmpty().withMessage('Confirm PIN is required.')
        .custom((value, { req }) => {
            if (value !== req.body.pin) {
                throw new Error('PINs do not match.');
            }
            return true;
        }),
];

export const changeWalletPinValidator = [
    // This often requires OTP verification first.
    // The OTP verification step would have its own validator.
    body('currentPin') // Or re-authentication with password
        .optional() // Might be handled by OTP
        .notEmpty().withMessage('Current PIN is required.')
        .isNumeric().withMessage('Current PIN must be numeric.'),
    body('newPin')
        .notEmpty().withMessage('New PIN is required.')
        .isLength({ min: 4, max: 6 }).withMessage('New PIN must be between 4 and 6 digits.')
        .isNumeric().withMessage('New PIN must be numeric.')
        .custom((value, { req }) => {
            if (req.body.currentPin && value === req.body.currentPin) { // Only if currentPin is provided
                throw new Error('New PIN cannot be the same as the current PIN.');
            }
            return true;
        }),
    body('confirmNewPin')
        .notEmpty().withMessage('Confirm new PIN is required.')
        .custom((value, { req }) => {
            if (value !== req.body.newPin) {
                throw new Error('New PINs do not match.');
            }
            return true;
        }),
];

export const setPayoutWalletAddressValidator = [
    // This often requires OTP + PIN verification first.
    body('cryptoSymbol')
        .notEmpty().withMessage('Cryptocurrency symbol is required.')
        .isIn(SUPPORTED_CRYPTO_SYMBOLS).withMessage('Invalid or unsupported cryptocurrency.'),
    body('address')
        .trim()
        .notEmpty().withMessage('Wallet address is required.')
        .isLength({ min: 20, max: 150 }).withMessage('Wallet address seems invalid.'), // Basic length check
    // Add more specific regex validation per crypto if possible/needed
    // e.g., .matches(/^T[A-Za-z1-9]{33}$/).withMessage('Invalid TRC20 address') for USDT on Tron
];

export const kycSubmitValidator = [
    body('documentType')
        .notEmpty().withMessage('Document type is required.')
        .isIn(['Passport', 'NationalID', 'DriversLicense']).withMessage('Invalid document type.'),
    body('documentNumber')
        .trim()
        .notEmpty().withMessage('Document number is required.')
        .isLength({ min: 5, max: 50 }).withMessage('Document number seems invalid.'),
    // For file uploads (documentFrontImage, documentBackImage, selfieImage),
    // validation is typically handled by middleware like Multer first.
    // You can add custom checks here if paths/URLs are sent in the body.
    // For example, checking if a string representing a URL is a valid URL:
    // body('documentFrontImageURL').optional().isURL().withMessage('Invalid document front image URL.'),
];

export const userIdParamValidator = [
    param('userId')
        .notEmpty().withMessage('User ID is required.')
        .isMongoId().withMessage('Invalid User ID format.'),
];