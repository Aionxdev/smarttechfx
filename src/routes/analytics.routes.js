// src/routes/analytics.routes.js (Backend)
import express from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js'; // <<< ENSURE THIS IS CORRECT
import {
    getUserPortfolioHistoryController,
    getUserDashboardSummaryController,
    getUserCoinUsageController,
    // ... other analytics controllers
} from '../controllers/analytics.controller.js';
import asyncHandler from '../utils/asyncHandler.util.js';

const router = express.Router();

// ALL user-specific analytics routes MUST have verifyJWT
router.use(verifyJWT); // Apply to all routes in this file

router.get('/user/dashboard-summary', asyncHandler(getUserDashboardSummaryController));
router.get('/user/portfolio-history', asyncHandler(getUserPortfolioHistoryController));
router.get('/user/coin-usage', asyncHandler(getUserCoinUsageController));

export default router;