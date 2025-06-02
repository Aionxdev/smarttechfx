// src/utils/logger.util.js
import config from '../config/index.js';

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4,
};

// Determine current log level from environment or default to INFO
const CURRENT_LOG_LEVEL_NAME = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
const CURRENT_LOG_LEVEL = LOG_LEVELS[CURRENT_LOG_LEVEL_NAME] !== undefined ? LOG_LEVELS[CURRENT_LOG_LEVEL_NAME] : LOG_LEVELS.INFO;


const log = (level, message, ...args) => {
    if (LOG_LEVELS[level.toUpperCase()] < CURRENT_LOG_LEVEL) {
        return; // Don't log if level is below current setting
    }

    const timestamp = new Date().toISOString();
    const levelTag = `[${level.toUpperCase()}]`;
    const appTag = `[${config.appName || 'APP'}]`;

    let logMessage = `${timestamp} ${appTag} ${levelTag}: ${message}`;

    if (args.length > 0) {
        const formattedArgs = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    // Attempt to stringify, handle circular references if they occur
                    return JSON.stringify(arg, (key, value) => {
                        if (value instanceof Error) {
                            return { message: value.message, stack: value.stack, name: value.name };
                        }
                        return value;
                    }, 2); // 2 spaces for pretty printing
                } catch (e) {
                    return '[Unserializable Object]';
                }
            }
            return arg;
        }).join(' ');
        logMessage += ` ${formattedArgs}`;
    }


    if (level.toUpperCase() === 'ERROR' || level.toUpperCase() === 'FATAL') {
        console.error(logMessage);
    } else if (level.toUpperCase() === 'WARN') {
        console.warn(logMessage);
    } else {
        console.log(logMessage);
    }

    // In a more advanced logger (like Winston), you'd also write to files, external services, etc.
};

const logger = {
    debug: (message, ...args) => log('DEBUG', message, ...args),
    info: (message, ...args) => log('INFO', message, ...args),
    warn: (message, ...args) => log('WARN', message, ...args),
    error: (message, ...args) => log('ERROR', message, ...args),
    fatal: (message, ...args) => log('FATAL', message, ...args), // For critical errors that might stop the app
};

export default logger;

// Example usage:
// import logger from '../utils/logger.util.js';
// logger.info("User logged in", { userId: '123', ip: '1.2.3.4' });
// logger.error("Database connection failed", new Error("DB timeout"));