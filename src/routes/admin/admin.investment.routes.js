// src/routes/admin/admin.investment.routes.js
import express from 'express';
import {
    getAllInvestmentsAdmin,
    getInvestmentDetailsAdmin,
    verifyInvestmentByAdmin,
    cancelPendingInvestmentByAdmin
} from '../../controllers/admin.controller.js';
import {
    investmentIdParamValidator,
    verifyInvestmentTxidValidator, // Re-using this from investment.validator.js
    adminCancelInvestmentValidator, // Need to create: body('reason').notEmpty()
    adminVerifyInvestmentValidator
} from '../../validators/index.js';
import { validate } from '../../middlewares/validation.middleware.js';
import asyncHandler from '../../utils/asyncHandler.util.js';

const router = express.Router();

router.get('/', asyncHandler(getAllInvestmentsAdmin));
router.get('/:investmentId', validate(investmentIdParamValidator), asyncHandler(getInvestmentDetailsAdmin));
// router.post(
//     '/:investmentId/verify', 
//     validate(investmentIdParamValidator), 
//     validate(verifyInvestmentTxidValidator), 
//     asyncHandler(verifyInvestmentByAdmin)
// );

router.post(
    '/:investmentId/verify',
    validate(investmentIdParamValidator),      // For the URL parameter
    validate(adminVerifyInvestmentValidator),  // For the request body
    asyncHandler(verifyInvestmentByAdmin)
);

// Create adminCancelInvestmentValidator: body('reason').notEmpty()...
// router.post('/:investmentId/cancel', validate(investmentIdParamValidator), validate(adminCancelInvestmentValidator), asyncHandler(cancelPendingInvestmentByAdmin));
router.post('/:investmentId/cancel', validate(investmentIdParamValidator), asyncHandler(cancelPendingInvestmentByAdmin)); // Simplified for now


export default router;