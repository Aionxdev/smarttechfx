// src/controllers/plan.controller.js
import { planService } from '../services/index.js';
import { ApiResponse, sendSuccessResponse } from '../utils/apiResponse.util.js';
import { HTTP_STATUS_CODES } from '../constants/index.js';
import { pick } from '../utils/index.js';

// Admin: Create a new investment plan
export const createPlan = async (req, res) => {
    const adminUserId = req.user.userId; // Assuming admin is authenticated
    const planData = pick(req.body, [
        'planName', 'description', 'investmentRange', 'dailyROIPercentage',
        'durationDays', 'reinvestmentOptionAvailable', 'isActive', 'tags'
    ]);
    const newPlan = await planService.createInvestmentPlan(planData, adminUserId);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.CREATED, newPlan, "Investment plan created successfully.");
};

// Admin: Get all investment plans (with pagination and filtering)
export const getAllPlans = async (req, res) => {
    const queryParams = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder', 'isActive']);
    const plansData = await planService.getAllInvestmentPlans(queryParams);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, plansData, "Investment plans fetched successfully.");
};

// Admin: Get a specific investment plan by ID
export const getPlanById = async (req, res) => {
    const { planId } = req.params;
    const plan = await planService.getInvestmentPlanById(planId);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, plan, "Investment plan details fetched successfully.");
};

// Admin: Update an investment plan
export const updatePlan = async (req, res) => {
    const adminUserId = req.user.userId;
    const { planId } = req.params;
    const updateData = pick(req.body, [ // Pick only allowed fields to update
        'planName', 'description', 'investmentRange', 'dailyROIPercentage',
        'durationDays', 'reinvestmentOptionAvailable', 'isActive', 'tags'
    ]);
    const updatedPlan = await planService.updateInvestmentPlan(planId, updateData, adminUserId);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, updatedPlan, "Investment plan updated successfully.");
};

// Admin: Toggle plan's active status
export const togglePlanStatus = async (req, res) => {
    const adminUserId = req.user.userId;
    const { planId } = req.params;
    const { isActive } = req.body; // Expecting a boolean in the body

    if (typeof isActive !== 'boolean') {
        throw new BadRequestError("isActive field must be a boolean (true or false).");
    }

    const updatedPlan = await planService.toggleInvestmentPlanStatus(planId, isActive, adminUserId);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, updatedPlan, `Investment plan status set to ${isActive ? 'Active' : 'Inactive'}.`);
};

// Admin: Delete an investment plan (if no associated investments)
export const deletePlan = async (req, res) => {
    const adminUserId = req.user.userId;
    const { planId } = req.params;
    const result = await planService.deleteInvestmentPlan(planId, adminUserId);
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, result, result.message);
};