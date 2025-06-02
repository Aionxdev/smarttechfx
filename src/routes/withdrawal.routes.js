// src/routes/withdrawal.routes.js
import express from 'express';
import {
    requestWithdrawalController,
    getMyWithdrawals,
    getMyWithdrawalById,
    getMyPayoutWalletAddresses,
    getWalletAddressInstructions,
    getWithdrawalTransactionStatus
} from '../controllers/withdrawal.controller.js';
import {
    requestWithdrawalValidator,
    withdrawalIdParamValidator
} from '../validators/index.js';
import { validate } from '../middlewares/validation.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import asyncHandler from '../utils/asyncHandler.util.js';

const router = express.Router();

// All withdrawal routes require authentication
router.use(verifyJWT);

router.post('/request', validate(requestWithdrawalValidator), asyncHandler(requestWithdrawalController));
router.get('/', asyncHandler(getMyWithdrawals)); // GET /withdrawals?status=Pending

router.get('/payout-addresses',
    asyncHandler(getMyPayoutWalletAddresses)
); // User views their saved addresses

router.get('/instructions',
    asyncHandler(getWalletAddressInstructions)
); // Generic instructions

router.get('/:withdrawalId',
    validate(withdrawalIdParamValidator),
    asyncHandler(getMyWithdrawalById)
);

router.get('/:withdrawalId/status',
    validate(withdrawalIdParamValidator),
    asyncHandler(getWithdrawalTransactionStatus)
);


export default router;