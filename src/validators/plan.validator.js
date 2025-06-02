// src/validators/plan.validator.js
import { body, param } from 'express-validator';

export const createInvestmentPlanValidator = [
    body('planName')
        .trim()
        .notEmpty().withMessage('Plan name is required.')
        .isLength({ min: 3, max: 50 }).withMessage('Plan name must be between 3 and 50 characters.'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters.'),
    body('investmentRange.minUSD')
        .notEmpty().withMessage('Minimum investment USD is required.')
        .isFloat({ min: 0 }).withMessage('Minimum investment USD must be a non-negative number.'),
    body('investmentRange.maxUSD')
        .notEmpty().withMessage('Maximum investment USD is required.')
        .isFloat({ min: 0 }).withMessage('Maximum investment USD must be a non-negative number.')
        .custom((value, { req }) => {
            if (parseFloat(value) < parseFloat(req.body.investmentRange.minUSD)) {
                throw new Error('Maximum investment USD must be greater than or equal to minimum USD.');
            }
            return true;
        }),
    body('dailyROIPercentage')
        .notEmpty().withMessage('Daily ROI percentage is required.')
        .isFloat({ min: 0, max: 100 }).withMessage('Daily ROI percentage must be between 0 and 100.'),
    body('durationDays')
        .notEmpty().withMessage('Duration in days is required.')
        .isInt({ min: 1 }).withMessage('Duration must be a positive integer (at least 1 day).'),
    body('reinvestmentOptionAvailable')
        .optional()
        .isBoolean().withMessage('Reinvestment option must be a boolean.'),
    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be a boolean.'),
    body('tags')
        .optional()
        .isArray().withMessage('Tags must be an array.')
        .custom((tags) => tags.every(tag => typeof tag === 'string' && tag.trim().length > 0))
        .withMessage('All tags must be non-empty strings.'),
];

export const updateInvestmentPlanValidator = [
    param('planId')
        .notEmpty().withMessage('Plan ID is required in URL parameters.')
        .isMongoId().withMessage('Invalid Plan ID format.'),
    // Optional fields, similar to create, but all are optional
    body('planName')
        .optional()
        .trim()
        .notEmpty().withMessage('Plan name cannot be empty if provided.')
        .isLength({ min: 3, max: 50 }).withMessage('Plan name must be between 3 and 50 characters.'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters.'),
    body('investmentRange.minUSD')
        .optional()
        .isFloat({ min: 0 }).withMessage('Minimum investment USD must be a non-negative number.'),
    body('investmentRange.maxUSD')
        .optional()
        .isFloat({ min: 0 }).withMessage('Maximum investment USD must be a non-negative number.')
        .custom((value, { req }) => {
            const minUSD = req.body.investmentRange?.minUSD;
            // Only validate if both min and max are potentially being updated
            if (minUSD !== undefined && parseFloat(value) < parseFloat(minUSD)) {
                throw new Error('Maximum investment USD must be greater than or equal to minimum USD.');
            }
            return true;
        }),
    body('dailyROIPercentage')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('Daily ROI percentage must be between 0 and 100.'),
    body('durationDays')
        .optional()
        .isInt({ min: 1 }).withMessage('Duration must be a positive integer (at least 1 day).'),
    body('reinvestmentOptionAvailable')
        .optional()
        .isBoolean().withMessage('Reinvestment option must be a boolean.'),
    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be a boolean.'),
    body('tags')
        .optional()
        .isArray().withMessage('Tags must be an array.')
        .custom((tags) => tags.every(tag => typeof tag === 'string' && tag.trim().length > 0))
        .withMessage('All tags must be non-empty strings.'),
];

export const planIdParamValidator = [
    param('planId')
        .notEmpty().withMessage('Plan ID is required.')
        .isMongoId().withMessage('Invalid Plan ID format.'),
];