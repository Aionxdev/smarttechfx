// src/models/Notification.model.js
import mongoose from 'mongoose';
import { NOTIFICATION_TYPES, USER_ROLES } from '../constants/index.js';

const notificationSchema = new mongoose.Schema(
    {
        user: { // Target user for the notification. Can be null for system-wide/admin broadcasts.
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        type: {
            type: String,
            enum: Object.values(NOTIFICATION_TYPES),
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: [true, "Notification title is required"],
            trim: true,
        },
        message: {
            type: String,
            required: [true, "Notification message is required"],
            trim: true,
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        readAt: {
            type: Date,
        },
        link: { // Optional deep link into the app (e.g., to view a specific investment)
            type: String,
            trim: true,
        },
        relatedResource: { // For linking to a specific document, e.g., an Investment or Withdrawal ID
            id: { type: mongoose.Schema.Types.ObjectId },
            model: { type: String }, // e.g., 'Investment', 'Withdrawal'
        },
        // For broadcast messages targeting specific roles or all users
        targetRoles: [{ 
            type: String, 
            enum: Object.values(USER_ROLES) 
        }], // If type is ANNOUNCEMENT
        isBroadcast: {
            type: Boolean,
            default: false,
        }
    },
    {
        timestamps: true, // createdAt will be the notification time
    }
);

// Compound index for querying user's unread notifications efficiently
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
// Index for broadcasts
notificationSchema.index({ isBroadcast: 1, type: 1, createdAt: -1 });


const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;