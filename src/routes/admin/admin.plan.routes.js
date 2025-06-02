// src/routes/admin/admin.plan.routes.js
import express from 'express';
import {
    createPlan,
    getAllPlans, // This is the admin version from plan.controller
    getPlanById,
    updatePlan,
    togglePlanStatus,
    deletePlan
} from '../../controllers/plan.controller.js';
import {
    createInvestmentPlanValidator,
    updateInvestmentPlanValidator,
    planIdParamValidator
} from '../../validators/index.js'; // or from './plan.validator.js'
import { validate } from '../../middlewares/validation.middleware.js';
import asyncHandler from '../../utils/asyncHandler.util.js';

const router = express.Router();

router.post('/', validate(createInvestmentPlanValidator), asyncHandler(createPlan));
router.get('/', asyncHandler(getAllPlans)); // Admin get all plans
router.get('/:planId', validate(planIdParamValidator), asyncHandler(getPlanById));
router.put('/:planId', validate(planIdParamValidator), validate(updateInvestmentPlanValidator), asyncHandler(updatePlan));
router.patch('/:planId/status', validate(planIdParamValidator), asyncHandler(togglePlanStatus)); // PATCH for partial update like status
router.delete('/:planId', validate(planIdParamValidator), asyncHandler(deletePlan));

export default router;