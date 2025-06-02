// src/validators/auth.validator.js
import { body, param, query } from 'express-validator';
import { OTP_PURPOSES, SUPPORTED_CRYPTO_SYMBOLS } from '../constants/index.js';
// import User from '../models/User.model.js'; // For custom validation like checking if email exists

export const registerUserValidator = [
    body('fullName')
        .trim()
        .notEmpty().withMessage('Full name is required.')
        .isLength({ min: 3, max: 100 }).withMessage('Full name must be between 3 and 100 characters.'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Invalid email address.')
        .normalizeEmail(),
    // Example custom validation (uncomment when User model is integrated):
    // .custom(async (value) => {
    //     const user = await User.findOne({ email: value });
    //     if (user) {
    //         return Promise.reject('E-mail already in use');
    //     }
    // }),
    body('password')
        .notEmpty().withMessage('Password is required.')
        .isLength({ min: 6, max: 50 }).withMessage('Password must be between 6 and 50 characters.'),
        // .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        // .withMessage('Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character.'),
    body('phoneNumber')
        .optional({ checkFalsy: true }) // Allows empty string or null
        .trim()
        .isMobilePhone('any', { strictMode: false }).withMessage('Invalid phone number format.'), // 'any' allows various formats, adjust as needed
    body('country')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('Country name seems invalid.'),
    body('preferredCrypto')
        .optional({ checkFalsy: true })
        .isIn(SUPPORTED_CRYPTO_SYMBOLS).withMessage('Invalid preferred cryptocurrency selected.'),
];

export const loginUserValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Invalid email address.')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required.'),
];

export const sendOtpValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Invalid email address.')
        .normalizeEmail(),
    body('purpose')
        .notEmpty().withMessage('OTP purpose is required.')
        .isIn(Object.values(OTP_PURPOSES)).withMessage('Invalid OTP purpose.'),
];

export const verifyOtpValidator = [
    body('email') // Or identifier used to send OTP
        .trim()
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Invalid email address.')
        .normalizeEmail(),
    body('otp')
        .trim()
        .notEmpty().withMessage('OTP is required.')
        .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits.')
        .isNumeric().withMessage('OTP must be numeric.'),
    body('purpose')
        .notEmpty().withMessage('OTP purpose is required.')
        .isIn(Object.values(OTP_PURPOSES)).withMessage('Invalid OTP purpose.'),
];

export const forgotPasswordValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Invalid email address.')
        .normalizeEmail(),
];

export const resetPasswordValidator = [
    body('token') // Usually comes from URL param or query, but can be in body
        .trim()
        .notEmpty().withMessage('Reset token is required.'),
    body('newPassword')
        .notEmpty().withMessage('New password is required.')
        .isLength({ min: 6, max: 50 }).withMessage('Password must be between 6 and 50 characters.'),
];

export const changePasswordValidator = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required.'),
    body('newPassword')
        .notEmpty().withMessage('New password is required.')
        .isLength({ min: 6, max: 50 }).withMessage('New password must be between 6 and 50 characters.')
        .custom((value, { req }) => {
            if (value === req.body.currentPassword) {
                throw new Error('New password cannot be the same as the current password.');
            }
            return true;
        }),
    body('confirmNewPassword')
        .notEmpty().withMessage('Confirm new password is required.')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('New passwords do not match.');
            }
            return true;
        }),
];

export const refreshTokenValidator = [
    // The refresh token will likely be in an HttpOnly cookie,
    // so no direct body validation is needed here unless you pass it in the body.
    // Validation for its presence would be in the controller/service.
];