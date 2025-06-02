// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { HTTP_STATUS_CODES, USER_ROLES } from '../constants/index.js';

import { UnauthorizedError, ForbiddenError } from '../utils/apiError.util.js'; // Ensure these are imported
import User from '../models/User.model.js'; // Ensure User model is imported
import logger from '../utils/logger.util.js'; // Assuming logger is imported


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

export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            // This should ideally not happen if verifyJWT runs first and populates req.user
            return next(new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "Authentication required."));
        }

        const userRole = req.user.role;
        if (!allowedRoles.includes(userRole)) {
            return next(new ApiError(
                HTTP_STATUS_CODES.FORBIDDEN,
                `Role '${userRole}' is not authorized to access this resource.`
            ));
        }
        next();
    };
};

export const verifyJWT = async (req, res, next) => {
    logger.debug('[verifyJWT] Middleware triggered.'); // Add this for initial check
    try {
        const token = req.cookies?.[config.jwt.cookieName] || req.header("Authorization")?.replace("Bearer ", "");
        logger.debug(`[verifyJWT] Token from cookie/header: ${token ? 'Exists' : 'Not Found'}`);

        if (!token) {
            logger.warn('[verifyJWT] No token provided.');
            throw new UnauthorizedError("Unauthorized request: No token provided"); // Could be line ~15-20
        }

        let decodedToken;
        try {
            decodedToken = jwt.verify(token, config.jwt.secret);
        } catch (jwtError) {
            logger.warn(`[verifyJWT] JWT verification failed: ${jwtError.message}`);
            if (jwtError.name === 'TokenExpiredError') {
                throw new UnauthorizedError("Token expired. Please log in again.");
            }
            throw new UnauthorizedError("Invalid token."); // Could be line ~25-30
        }

        // logger.debug('[verifyJWT] Token decoded:', decodedToken);

        if (!decodedToken || !decodedToken.userId) {
            // logger.warn('[verifyJWT] Invalid token: Missing userId in decoded payload.');
            throw new UnauthorizedError("Invalid token: Missing user identifier."); // Could be line ~35-40
        }

        const user = await User.findById(decodedToken.userId).select("-password -walletPin");
        // logger.debug(`[verifyJWT] User found from DB: ${user ? user.email : 'Not Found'}`);

        if (!user) {
            // logger.warn(`[verifyJWT] User not found in DB for userId: ${decodedToken.userId}`);
            throw new UnauthorizedError("Invalid Access Token: User not found"); // Could be line ~45-50
        }

        // Optional: Check user status (e.g., active, not suspended)
        if (user.status !== 'Active') { // Assuming 'Active' is a constant from ACCOUNT_STATUS
            // logger.warn(`[verifyJWT] User ${user.email} is not active. Status: ${user.status}`);
            throw new ForbiddenError(`User account is ${user.status}. Access denied.`);
        }

        req.user = user; // Populate req.user with the Mongoose user document
        // logger.info(`[verifyJWT] User ${user.email} authenticated successfully.`);
        next();
    } catch (error) {
        // This is where the error message "Authentication failed." likely originates if it's a generic catch
        logger.error('[verifyJWT] Authentication error caught:', { message: error.message, name: error.name /*, stack: error.stack */ });

        const statusCode = error.statusCode || HTTP_STATUS_CODES.UNAUTHORIZED;
        const message = error.message || "Authentication failed.";

        // Line 59 is likely here if creating a new ApiError instance when one was already thrown
        // If 'error' is already an ApiError, just pass it. Otherwise, wrap it.
        if (error instanceof ApiError) { // <<< CHECK THIS LOGIC
            return next(error);
        }
        // Line 59 could be this one, if 'error' wasn't an instance of ApiError:
        return next(new ApiError(statusCode, message)); // Line 59 (or around there)
    }
};
// Example of combining them:
// router.get('/admin-only', verifyJWT, authorizeRoles(USER_ROLES.ADMIN), adminController.getData);
