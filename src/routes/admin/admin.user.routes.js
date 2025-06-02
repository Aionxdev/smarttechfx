// src/routes/admin/admin.user.routes.js
import express from 'express';
import {
    getAllUsersAdmin,
    getUserDetailsAdmin,
    updateUserStatusAdmin,
    updateUserKycStatusAdmin
} from '../../controllers/admin.controller.js';

import {
    userIdParamValidator,
    adminUpdateUserStatusValidator,
    adminUpdateKycStatusValidator
} from '../../validators/index.js';

import { validate } from '../../middlewares/validation.middleware.js';
import asyncHandler from '../../utils/asyncHandler.util.js';

const router = express.Router();

router.get('/', asyncHandler(getAllUsersAdmin));
router.get('/:userId', validate(userIdParamValidator), asyncHandler(getUserDetailsAdmin));
// Create adminUpdateUserStatusValidator: body('status').isIn(Object.values(ACCOUNT_STATUS)), body('reason').optional()...
// router.put('/:userId/status', validate(userIdParamValidator), validate(adminUpdateUserStatusValidator), asyncHandler(updateUserStatusAdmin));
router.put('/:userId/status', validate(userIdParamValidator), asyncHandler(updateUserStatusAdmin)); // Simplified for now

// Create adminUpdateKycStatusValidator: body('kycStatus').isIn(Object.values(KYC_STATUS))..., body('rejectionReason').optional()...
// router.put('/:userId/kyc', validate(userIdParamValidator), validate(adminUpdateKycStatusValidator), asyncHandler(updateUserKycStatusAdmin));
router.put('/:userId/kyc', validate(userIdParamValidator), asyncHandler(updateUserKycStatusAdmin)); // Simplified for now


export default router;