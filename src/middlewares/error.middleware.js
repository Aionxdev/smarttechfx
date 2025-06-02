// src/middlewares/error.middleware.js
import config from '../config/index.js';
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

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
    let message = err.message || "Internal Server Error";
    let errors = err.errors || [];
    let stack = err.stack;

    // Handle specific Mongoose errors (examples)
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        statusCode = HTTP_STATUS_CODES.BAD_REQUEST;
        message = `Invalid ID format for resource: ${err.path}`;
        errors = [{ field: err.path, message: `Invalid ID format` }];
    } else if (err.name === 'ValidationError') { // Mongoose validation error
        statusCode = HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY; // Or BAD_REQUEST
        message = "Validation Failed";
        errors = Object.values(err.errors).map(el => ({
            field: el.path,
            message: el.message,
        }));
    } else if (err.code === 11000) { // Mongoose duplicate key error
        statusCode = HTTP_STATUS_CODES.CONFLICT;
        const field = Object.keys(err.keyValue)[0];
        message = `Duplicate field value entered for '${field}'. Please use another value.`;
        errors = [{ field, message: `The ${field} '${err.keyValue[field]}' already exists.` }];
    }

    // If it's not an ApiError instance we created, it might be an unexpected error
    if (!(err instanceof ApiError) && statusCode === HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR) {
        // Log more critical errors for internal server issues
        console.error("UNHANDLED ERROR:", err);
        // In production, you might not want to send the original message or stack
        if (config.env === 'production') {
            message = "An unexpected error occurred. Please try again later.";
            stack = undefined; // Don't leak stack trace in production
            errors = [];
        }
    }

    // Ensure a consistent response structure
    res.status(statusCode).json({
        success: false,
        message,
        errors: errors.length > 0 ? errors : undefined, // Only include errors array if it has content
        ...(config.env === 'development' && stack && { stack }), // Include stack in development
    });
};

export default errorHandler;