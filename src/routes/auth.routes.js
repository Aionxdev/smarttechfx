// src/routes/auth.routes.js
import express from 'express';
import {
    register,
    login,
    logout,
    refreshAccessToken,
    sendOtp,
    verifyOtpController,
    requestPasswordReset,
    performPasswordReset,
    getCurrentAuthenticatedUser
} from '../controllers/auth.controller.js';
import {
    registerUserValidator,
    loginUserValidator,
    sendOtpValidator,
    verifyOtpValidator,
    forgotPasswordValidator,
    resetPasswordValidator
} from '../validators/index.js';
import { validate } from '../middlewares/validation.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js'; // For routes needing auth
import asyncHandler from '../utils/asyncHandler.util.js';

const router = express.Router();

router.post('/register', validate(registerUserValidator), asyncHandler(register));
router.post('/login', validate(loginUserValidator), asyncHandler(login));
router.post('/logout', verifyJWT, asyncHandler(logout)); // verifyJWT to ensure a user is logged in to log out

router.post('/refresh-token', asyncHandler(refreshAccessToken)); // Uses refresh token from cookie

router.post('/send-otp', validate(sendOtpValidator), asyncHandler(sendOtp));
router.post('/verify-otp', validate(verifyOtpValidator), asyncHandler(verifyOtpController));

router.post('/forgot-password', validate(forgotPasswordValidator), asyncHandler(requestPasswordReset));
router.post('/reset-password', validate(resetPasswordValidator), asyncHandler(performPasswordReset));

router.get('/me', verifyJWT, asyncHandler(getCurrentAuthenticatedUser)); // Get current user from token

export default router;