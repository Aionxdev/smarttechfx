// src/utils/asyncHandler.util.js

/**
 * Wraps an asynchronous function to catch errors and pass them to the next middleware.
 * This is primarily for Express route handlers.
 * If using 'express-async-errors', this might be redundant for route handlers.
 *
 * @param {Function} requestHandler - The asynchronous function to wrap.
 * @returns {Function} An Express middleware function.
 */
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next))
            .catch((err) => next(err));
    };
};

export default asyncHandler;

// Example usage in a route definition:
// import asyncHandler from '../utils/asyncHandler.util.js';
// import { someAsyncController } from '../controllers/some.controller.js';
//
// router.get('/some-route', asyncHandler(someAsyncController));