// src/routes/plan.routes.js
import express from 'express';
import { getAvailableInvestmentPlans } from '../controllers/investment.controller.js'; // Controller for viewing plans
import { getPlanById as getPublicPlanById } from '../controllers/plan.controller.js'; // Admin controller method adapted for public view if needed
import { planIdParamValidator } from '../validators/index.js';
import { validate } from '../middlewares/validation.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js'; // Optional: if only logged-in users can see plans
import asyncHandler from '../utils/asyncHandler.util.js';

const router = express.Router();

// These routes can be public or require simple auth (verifyJWT)
// For now, let's assume authenticated users can view plans
// router.use(verifyJWT); // Or remove if plans are fully public

router.get('/', asyncHandler(getAvailableInvestmentPlans)); // Fetches active plans
router.get('/:planId', validate(planIdParamValidator), asyncHandler(getPublicPlanById)); // User views a specific plan

export default router;