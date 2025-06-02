// src/routes/chat.routes.js (Backend - NEW FILE)
import express from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
    getUserChatSessionHistoryController,
    getMyChatSessionsController
} from '../controllers/chat.controller.js';
import { sessionIdParamValidator } from '../validators/index.js'; // Create/use a generic ID validator
import { validate } from '../middlewares/validation.middleware.js';
import asyncHandler from '../utils/asyncHandler.util.js';

const router = express.Router();

// All routes require user authentication
router.use(verifyJWT);

// Get a list of the current user's past chat sessions
router.get('/my-sessions', asyncHandler(getMyChatSessionsController));

// Get the history/transcript of a specific chat session for the current user
router.get('/history/:sessionId', validate(sessionIdParamValidator), asyncHandler(getUserChatSessionHistoryController));

// Note: Initiating a chat is handled via WebSockets ('user_initiate_chat' event)

export default router;