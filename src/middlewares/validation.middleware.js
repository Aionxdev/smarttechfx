// src/middlewares/validation.middleware.js
import { validationResult } from 'express-validator'; // Assuming express-validator
import { HTTP_STATUS_CODES } from '../constants/index.js';

// Placeholder for ApiError until utils are created
class ApiError extends Error {
    constructor(statusCode, message = "Something went wrong", errors = [], stack = "") {
        super(message);
        this.statusCode = statusCode;
        this.data = null;
        this.message = message;
        this.success = false;
        this.errors = errors;
        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Middleware to handle validation errors from express-validator.
 * @param {Array<import('express-validator').ValidationChain>} validations - An array of validation chains.
 * @returns {Function} Express middleware function.
 */
export const validate = (validations) => {
    return async (req, res, next) => {
        // Run all validations
        for (let validation of validations) {
            const result = await validation.run(req);
            // express-validator v7: `errors` is on the result object if you run one by one.
            // If you `await Promise.all(validations.map(validation => validation.run(req)));`
            // then you'd check `validationResult(req)` after.
            // For simplicity here, we assume we might check errors after each or all.
        }

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        const extractedErrors = errors.array().map(err => ({
            field: err.type === 'field' ? err.path : (err.param || 'unknown'), // err.param is for older express-validator
            message: err.msg,
            // value: err.value, // Optionally include the value that failed
        }));

        return next(new ApiError(
            HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY,
            "Validation failed. Please check your input.",
            extractedErrors
        ));
    };
};

// How to use in routes:
// import { body } from 'express-validator';
// import { validate } from '../middlewares/validation.middleware.js';
//
// router.post(
//   '/register',
//   validate([
//     body('email').isEmail().withMessage('Must be a valid email'),
//     body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
//   ]),
//   authController.register
// );