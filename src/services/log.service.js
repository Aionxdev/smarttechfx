// src/services/log.service.js
import { Log } from '../models/index.js'; // Import the Log model
import logger from '../utils/logger.util.js'; // Import your console/file logger
import { LOG_LEVELS, LOG_EVENT_TYPES } from '../constants/index.js'; // Import constants

/**
 * Creates a structured log entry in the database and also logs to console/file.
 * @param {string} level - Log level (e.g., LOG_LEVELS.INFO, LOG_LEVELS.ADMIN_ACTION).
 * @param {string} eventType - Specific event type (e.g., LOG_EVENT_TYPES.USER_LOGGED_IN).
 * @param {string} message - Human-readable log message.
 * @param {string|null} userId - ID of the user associated with the event (if any).
 * @param {object} details - Additional structured data for the log entry.
 * @param {string|null} ipAddress - IP address associated with the event (if any).
 * @param {string|null} userAgent - User agent string.
 * @param {string|null} adminUserId - ID of the admin user performing an action (if applicable).
 * @param {string|null} requestMethod - HTTP request method.
 * @param {string|null} requestUrl - HTTP request URL.
 * @param {number|null} statusCode - HTTP response status code.
 */
export const createLogEntry = async (
    level,
    eventType,
    message,
    userId = null,
    details = {},
    ipAddress = null,
    userAgent = null,
    adminUserId = null,
    requestMethod = null,
    requestUrl = null,
    statusCode = null
) => {
    try {
        // First, log to console/file using your utility logger
        switch (level) {
            case LOG_LEVELS.DEBUG:
                logger.debug(message, { userId, eventType, ...details });
                break;
            case LOG_LEVELS.INFO:
            case LOG_LEVELS.USER_ACTION:
            case LOG_LEVELS.SYSTEM_EVENT:
                logger.info(message, { userId, eventType, ...details });
                break;
            case LOG_LEVELS.WARN:
                logger.warn(message, { userId, eventType, ...details });
                break;
            case LOG_LEVELS.ERROR:
            case LOG_LEVELS.ADMIN_ACTION: // Admin actions can be info or error depending on context, log as warn/error if sensitive
                logger.error(message, { userId, eventType, ...details }); // Or logger.warn
                break;
            case LOG_LEVELS.FATAL:
                logger.fatal(message, { userId, eventType, ...details });
                break;
            default:
                logger.info(message, { userId, eventType, ...details });
        }

        // Then, create the database log entry
        await Log.create({
            level,
            eventType,
            message,
            user: userId,
            adminUser: adminUserId,
            ipAddress,
            userAgent,
            requestMethod,
            requestUrl,
            statusCode,
            details,
        });
    } catch (error) {
        // Log the failure to create a DB log entry to the console/file logger
        // Avoid throwing an error here to prevent cascading failures if DB logging fails
        logger.error('CRITICAL: Failed to create database log entry.', {
            originalError: error.message,
            logData: { level, eventType, message, userId }
        });
    }
};

// Example usage (this would be in other services/controllers):
// import { createLogEntry } from './log.service.js';
// import { LOG_LEVELS, LOG_EVENT_TYPES } from '../constants/index.js';
//
// // In a user login controller/service:
// createLogEntry(
//   LOG_LEVELS.USER_ACTION,
//   LOG_EVENT_TYPES.USER_LOGGED_IN,
//   `User ${user.email} logged in successfully.`,
//   user._id,
//   { email: user.email, role: user.role },
//   req.ip, // from request object
//   req.headers['user-agent'] // from request object
// );