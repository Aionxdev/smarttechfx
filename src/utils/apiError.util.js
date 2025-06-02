// src/utils/apiError.util.js
import { HTTP_STATUS_CODES } from "../constants/index.js";

class ApiError extends Error {
    /**
     * Creates an API Error instance.
     * @param {number} statusCode - The HTTP status code for the error.
     * @param {string} message - The error message.
     * @param {Array<object>} errors - An array of specific error details (e.g., field validation errors).
     * @param {string} stack - Optional stack trace.
     */
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = ""
    ) {
        super(message);
        this.statusCode = statusCode;
        this.data = null; // Standard field, usually null for errors
        this.message = message;
        this.success = false; // Indicates operation failure
        this.errors = errors; // Specific error details, e.g., [{ field: 'email', message: 'Invalid format' }]

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

// Common Error Instances (optional, but can be convenient)
export class BadRequestError extends ApiError {
    constructor(message = "Bad Request", errors = []) {
        super(HTTP_STATUS_CODES.BAD_REQUEST, message, errors);
    }
}

export class UnauthorizedError extends ApiError {
    constructor(message = "Unauthorized", errors = []) {
        super(HTTP_STATUS_CODES.UNAUTHORIZED, message, errors);
    }
}

export class ForbiddenError extends ApiError {
    constructor(message = "Forbidden", errors = []) {
        super(HTTP_STATUS_CODES.FORBIDDEN, message, errors);
    }
}

export class NotFoundError extends ApiError {
    constructor(message = "Resource Not Found", errors = []) {
        super(HTTP_STATUS_CODES.NOT_FOUND, message, errors);
    }
}

export class ConflictError extends ApiError {
    constructor(message = "Conflict", errors = []) {
        super(HTTP_STATUS_CODES.CONFLICT, message, errors);
    }
}

export class UnprocessableEntityError extends ApiError {
    constructor(message = "Unprocessable Entity", errors = []) {
        super(HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY, message, errors);
    }
}

// ADD THIS CLASS
export class TooManyRequestsError extends ApiError {
    constructor(message = "Too Many Requests", errors = []) {
        super(HTTP_STATUS_CODES.TOO_MANY_REQUESTS, message, errors);
    }
}

// ADD THIS CLASS (if used, for example in crypto.service.js)
export class ServiceUnavailableError extends ApiError {
    constructor(message = "Service Unavailable", errors = []) {
        super(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE, message, errors);
    }
}

export default ApiError;