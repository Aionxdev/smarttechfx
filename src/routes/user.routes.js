// src/routes/user.routes.js
import express from 'express';
import {
    getMyProfile,
    updateMyProfile,
    changeMyPassword,
    setMyWalletPin,
    requestPinChangeOtp,
    changeMyWalletPin,
    setMyPayoutWalletAddress,
    requestWalletChangeOtp,
    changeMyPayoutWalletAddress,
    // getMyActivityLog,
    getMyActivityLogController,
    getMyNotificationsController,
    markNotificationReadController,
    markAllNotificationsReadController
    // submitKyc, setupTwoFactor, verifyTwoFactor, disableTwoFactor (TODOs)
} from '../controllers/user.controller.js';
import { updatePreferredCrypto } from '../controllers/user.controller.js';
import {
    updateUserProfileValidator,
    changePasswordValidator,
    setWalletPinValidator,
    changeWalletPinValidator, // This might need OTP step before, or integrate OTP logic in controller/service
    setPayoutWalletAddressValidator,
    notificationIdParamValidator,
    // kycSubmitValidator (TODO)
} from '../validators/index.js';
import { validate } from '../middlewares/validation.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import asyncHandler from '../utils/asyncHandler.util.js';    


const router = express.Router();

// All user routes require authentication
router.use(verifyJWT);

router.get('/profile', asyncHandler(getMyProfile));
router.put('/profile', validate(updateUserProfileValidator), asyncHandler(updateMyProfile));

router.post('/change-password', validate(changePasswordValidator), asyncHandler(changeMyPassword));

router.post('/pin/set', validate(setWalletPinValidator), asyncHandler(setMyWalletPin));
router.post('/pin/request-change-otp', asyncHandler(requestPinChangeOtp)); // OTP before changing PIN
router.post('/pin/change', validate(changeWalletPinValidator), asyncHandler(changeMyWalletPin)); // Assumes OTP is part of body or separate step

router.post('/payout-wallet', validate(setPayoutWalletAddressValidator), asyncHandler(setMyPayoutWalletAddress));
router.post('/payout-wallet/request-change-otp', asyncHandler(requestWalletChangeOtp)); // OTP before changing wallet
router.put('/payout-wallet/change', validate(setPayoutWalletAddressValidator), asyncHandler(changeMyPayoutWalletAddress)); // Simplified, might need OTP in body

router.put('/preferred-crypto', asyncHandler(updatePreferredCrypto)); // Add this line

// router.get('/activity-log', asyncHandler(getMyActivityLog));

router.get('/me/activity-log', asyncHandler(getMyActivityLogController)); // New route

router.get('/me/notifications', asyncHandler(getMyNotificationsController));
router.patch('/me/notifications/:notificationId/read', asyncHandler(markNotificationReadController), validate(notificationIdParamValidator)); // PATCH is suitable for updates
router.post('/me/notifications/mark-all-read', asyncHandler(markAllNotificationsReadController), validate(notificationIdParamValidator)); // POST for a bulk action


// router.post('/kyc/submit', validate(kycSubmitValidator), asyncHandler(submitKyc)); // TODO
// router.post('/2fa/setup', asyncHandler(setupTwoFactor)); // TODO
// router.post('/2fa/verify', asyncHandler(verifyTwoFactor)); // TODO
// router.post('/2fa/disable', asyncHandler(disableTwoFactor)); // TODO

export default router;