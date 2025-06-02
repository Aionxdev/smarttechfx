// src/middlewares/rateLimiter.middleware.js
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

// In-memory store for rate limiting (very basic)
const requestCounts = new Map();

/**
 * Basic IP-based rate limiter.
 * @param {number} limit - Max requests allowed.
 * @param {number} windowMs - Time window in milliseconds.
 */
export const basicRateLimiter = (limit = 100, windowMs = 15 * 60 * 1000) => { // Default: 100 requests per 15 minutes
    return (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress;

        if (!requestCounts.has(ip)) {
            requestCounts.set(ip, { count: 0, resetTime: Date.now() + windowMs });
        }

        const ipData = requestCounts.get(ip);

        if (Date.now() > ipData.resetTime) {
            // Reset window
            ipData.count = 0;
            ipData.resetTime = Date.now() + windowMs;
        }

        ipData.count += 1;

        if (ipData.count > limit) {
            // Clean up old entries occasionally (very basic cleanup)
            if (Math.random() < 0.01) { // 1% chance to cleanup
                const now = Date.now();
                for (const [key, value] of requestCounts.entries()) {
                    if (value.resetTime < now) {
                        requestCounts.delete(key);
                    }
                }
            }
            return next(new ApiError(HTTP_STATUS_CODES.TOO_MANY_REQUESTS, "Too many requests, please try again later."));
        }

        next();
    };
};

// For a more robust solution, consider `express-rate-limit`
// yarn add express-rate-limit
// import rateLimit from 'express-rate-limit';
// export const apiLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
//   standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
//   legacyHeaders: false, // Disable the `X-RateLimit-*` headers
//   handler: (req, res, next, options) => {
//       next(new ApiError(options.statusCode, options.message));
//   }
// });