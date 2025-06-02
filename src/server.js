// src/server.js
import http from 'http';
// Removed: import { Server as SocketIOServer } from 'socket.io';
import app from './app.js'; // The configured Express application
import config from './config/index.js'; // For port and database connection
import logger from './utils/logger.util.js';
// Removed: import initializeSocketHandlers from './socket/socketHandlers.js';
import mongoose from 'mongoose'; // Import mongoose for graceful shutdown

const PORT = config.port || 8800; // Ensure consistent port usage

// Create HTTP server directly with the Express app
const server = http.createServer(app);

// --- Graceful Shutdown Handler ---
const gracefulShutdown = (signal) => {
    logger.warn(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        logger.info('HTTP server closed.');
        // Close database connection
        mongoose.connection.close(false).then(() => {
            logger.info('MongoDB connection closed.');
            process.exit(0); // Exit after server and DB close
        }).catch(err => {
            logger.error('Error closing MongoDB connection during shutdown:', err);
            process.exit(1); // Exit with error if DB close fails
        });
    });

    // If server hasn't finished in X seconds, force shutdown
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000); // 10 seconds (adjust as needed)
};


// --- Start Server Function ---
const startServer = async () => {
    try {
        // 1. Connect to the database
        await config.connectDB(); // This function already logs success or exits on failure

        // 2. Start listening for HTTP requests
        server.listen(PORT, () => {
            logger.info(`🚀 Server is running on port ${PORT}`);
            logger.info(`🔗 API available at http://localhost:${PORT}${config.api?.prefix || '/api/v1'}`); // Added optional chaining for config.api
            logger.info(`NODE_ENV: ${config.env}`);
        });

        // Handle server errors (e.g., port in use)
        server.on('error', (error) => {
            if (error.syscall !== 'listen') {
                throw error;
            }
            const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;
            switch (error.code) {
                case 'EACCES':
                    logger.fatal(`${bind} requires elevated privileges`);
                    process.exit(1);
                    break;
                case 'EADDRINUSE':
                    logger.fatal(`${bind} is already in use`);
                    process.exit(1);
                    break;
                default:
                    throw error;
            }
        });

    } catch (error) {
        logger.fatal('Failed to start server:', error);
        process.exit(1);
    }
};

// --- Global Error Handlers for the Node.js Process ---
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Consider a graceful shutdown for unhandled rejections as well,
    // as the application might be in an inconsistent state.
    // For now, just logging. If you decide to shutdown:
    // gracefulShutdown('Unhandled Rejection');
});

process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught Exception:', error);
    // This is critical. Always shut down.
    gracefulShutdown('Uncaught Exception');
});

// --- Signal Handlers for Graceful Shutdown ---
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));


// --- Initiate Server Start ---
startServer();