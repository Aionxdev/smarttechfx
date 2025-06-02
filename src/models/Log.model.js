// src/models/Log.model.js
import mongoose from 'mongoose';
import { LOG_LEVELS, LOG_EVENT_TYPES } from '../constants/index.js';

const logSchema = new mongoose.Schema(
    {
        level: { // e.g., Info, Warn, Error, AdminAction, UserAction
            type: String,
            enum: Object.values(LOG_LEVELS),
            default: LOG_LEVELS.INFO,
            index: true,
        },
        eventType: { // Specific event type, e.g., "UserLoggedIn", "InvestmentCreated"
            type: String,
            enum: Object.values(LOG_EVENT_TYPES), // Ensure it's a known event type
            required: true,
            index: true,
        },
        message: { // Human-readable log message
            type: String,
            required: true,
            trim: true,
        },
        user: { // User associated with the log (if applicable)
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        adminUser: { // Admin user who performed an action (if applicable and different from 'user')
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        ipAddress: { type: String, trim: true },
        userAgent: { type: String, trim: true }, // Browser/device info
        requestMethod: { type: String, trim: true }, // e.g., GET, POST
        requestUrl: { type: String, trim: true },
        statusCode: { type: Number }, // HTTP status code of response, if applicable

        details: { // Any additional structured data related to the log
            type: mongoose.Schema.Types.Mixed, // Allows for flexible object storage
        },
        // Optional: for performance critical logs, consider if indexing `details` subfields is needed
    },
    {
        timestamps: true, // createdAt will be the log entry time
        // Capped collection for logs if you want to auto-delete old logs to save space
        // capped: { size: 1024 * 1024 * 100, max: 100000 } // e.g. 100MB or 100,000 documents
    }
);

logSchema.index({ level: 1, eventType: 1, createdAt: -1 });
logSchema.index({ user: 1, createdAt: -1 }); // For user activity logs
logSchema.index({ createdAt: -1 }); // General chronological sorting

const Log = mongoose.model('Log', logSchema);
export default Log;