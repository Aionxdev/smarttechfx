// src/routes/investment.routes.js
import express from 'express';
import {
    createInvestment,
    getMyInvestments,
    getMyInvestmentById,
    getInvestmentProgress,
    submitInvestmentTxid,
} from '../controllers/investment.controller.js';
import {
    createInvestmentValidator,
    investmentIdParamValidator,
    submitTxidValidator 
} from '../validators/index.js';
import { validate } from '../middlewares/validation.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import asyncHandler from '../utils/asyncHandler.util.js';

const router = express.Router();

// All investment routes require authentication
router.use(verifyJWT);

router.post('/', validate(createInvestmentValidator), asyncHandler(createInvestment));
router.get('/', asyncHandler(getMyInvestments)); // GET /investments?status=Active&page=1
router.get('/:investmentId', validate(investmentIdParamValidator), asyncHandler(getMyInvestmentById));
// router.get('/:investmentId/progress', validate(investmentIdParamValidator), asyncHandler(getInvestmentProgress));
router.get('/:investmentId/progress', validate(investmentIdParamValidator), asyncHandler(getInvestmentProgress)); // Corrected, ensure controller exists


// Route for submitting TXID
router.post(
    '/:investmentId/submit-txid',
    validate(investmentIdParamValidator), // Validate the investmentId in the URL
    validate(submitTxidValidator),       // Validate the request body (the TXID)
    asyncHandler(submitInvestmentTxid)
);

export default router;