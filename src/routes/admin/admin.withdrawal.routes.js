// src/routes/admin/admin.withdrawal.routes.js
import express from 'express';
import {
    getAllWithdrawalsAdmin,
    // getWithdrawalDetailsAdmin, // Can be added if needed, similar to investment
    approveWithdrawalByAdmin,
    rejectWithdrawalByAdmin
} from '../../controllers/admin.controller.js';
import {
    withdrawalIdParamValidator,
    adminApproveWithdrawalValidator, // Re-using from withdrawal.validator.js
    adminRejectWithdrawalValidator   // Re-using from withdrawal.validator.js
} from '../../validators/index.js';
import { validate } from '../../middlewares/validation.middleware.js';
import asyncHandler from '../../utils/asyncHandler.util.js';

const router = express.Router();

router.get('/', asyncHandler(getAllWithdrawalsAdmin));
// router.get('/:withdrawalId', validate(withdrawalIdParamValidator), asyncHandler(getWithdrawalDetailsAdmin));
router.post('/:withdrawalId/approve', validate(withdrawalIdParamValidator), validate(adminApproveWithdrawalValidator), asyncHandler(approveWithdrawalByAdmin));
router.post('/:withdrawalId/reject', validate(withdrawalIdParamValidator), validate(adminRejectWithdrawalValidator), asyncHandler(rejectWithdrawalByAdmin));

export default router;