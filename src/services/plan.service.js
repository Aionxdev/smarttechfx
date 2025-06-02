// src/services/plan.service.js
import { InvestmentPlan, Investment } from '../models/index.js';
import ApiError, { NotFoundError, BadRequestError, ConflictError } from '../utils/apiError.util.js';
import { HTTP_STATUS_CODES } from '../constants/index.js';
import logger from '../utils/logger.util.js';
import { DEFAULT_PAGINATION_LIMIT, MAX_PAGINATION_LIMIT } from '../constants/index.js';


export const createInvestmentPlan = async (planData, adminUserId) => {
    const { planName, investmentRange, dailyROIPercentage, durationDays } = planData;

    const existingPlan = await InvestmentPlan.findOne({ planName });
    if (existingPlan) {
        throw new ConflictError(`An investment plan with the name "${planName}" already exists.`);
    }

    if (investmentRange.minUSD >= investmentRange.maxUSD) {
        throw new BadRequestError("Minimum investment amount must be less than maximum amount.");
    }

    const newPlan = new InvestmentPlan({
        ...planData,
        createdBy: adminUserId,
    });
    await newPlan.save();
    logger.info(`New investment plan "${newPlan.planName}" (ID: ${newPlan._id}) created by admin ${adminUserId}`);
    return newPlan;
};

export const getInvestmentPlanById = async (planId) => {
    const plan = await InvestmentPlan.findById(planId);
    if (!plan) {
        throw new NotFoundError(`Investment plan with ID "${planId}" not found.`);
    }
    return plan;
};

export const getAllInvestmentPlans = async (queryParams = {}) => {
    const { page = 1, limit = DEFAULT_PAGINATION_LIMIT, sortBy = 'createdAt', sortOrder = 'desc', isActive } = queryParams;

    const query = {};
    if (isActive !== undefined) {
        query.isActive = isActive === 'true' || isActive === true;
    }

    const options = {
        page: Math.max(1, parseInt(page, 10)),
        limit: Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit, 10))),
        sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
        lean: true, // For faster queries if not modifying results
    };

    // Mongoose-paginate-v2 is great for this, but implementing basic pagination:
    const plans = await InvestmentPlan.find(query)
        .sort(options.sort)
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .lean();

    const totalPlans = await InvestmentPlan.countDocuments(query);

    return {
        plans,
        totalPages: Math.ceil(totalPlans / options.limit),
        currentPage: options.page,
        totalPlans,
    };
};

export const getActiveInvestmentPlansForUser = async () => {
    // Typically, users would see active plans
    return InvestmentPlan.find({ isActive: true }).sort({ 'investmentRange.minUSD': 1, displayOrder: 1 }).lean();
};


export const updateInvestmentPlan = async (planId, updateData, adminUserId) => {
    const plan = await InvestmentPlan.findById(planId);
    if (!plan) {
        throw new NotFoundError(`Investment plan with ID "${planId}" not found.`);
    }

    // Prevent changing planName if investments exist for it? (Business decision)
    if (updateData.planName && updateData.planName !== plan.planName) {
        const existingPlanName = await InvestmentPlan.findOne({ planName: updateData.planName, _id: { $ne: planId } });
        if (existingPlanName) {
            throw new ConflictError(`Another investment plan with the name "${updateData.planName}" already exists.`);
        }
    }
    if (updateData.investmentRange) {
        const minUSD = updateData.investmentRange.minUSD !== undefined ? updateData.investmentRange.minUSD : plan.investmentRange.minUSD;
        const maxUSD = updateData.investmentRange.maxUSD !== undefined ? updateData.investmentRange.maxUSD : plan.investmentRange.maxUSD;
        if (minUSD >= maxUSD) {
            throw new BadRequestError("Minimum investment amount must be less than maximum amount.");
        }
    }

    Object.assign(plan, updateData);
    plan.updatedBy = adminUserId; // Assuming an updatedBy field
    await plan.save();
    logger.info(`Investment plan "${plan.planName}" (ID: ${planId}) updated by admin ${adminUserId}`);
    return plan;
};

export const toggleInvestmentPlanStatus = async (planId, isActive, adminUserId) => {
    const plan = await InvestmentPlan.findById(planId);
    if (!plan) {
        throw new NotFoundError(`Investment plan with ID "${planId}" not found.`);
    }

    if (isActive === false) {
        // Business rule: Can you deactivate a plan if there are active investments using it?
        // For now, we'll allow it. The plan simply won't be available for new investments.
        // const activeInvestments = await Investment.countDocuments({ plan: planId, status: INVESTMENT_STATUS.ACTIVE });
        // if (activeInvestments > 0) {
        //     throw new BadRequestError("Cannot deactivate plan with active investments. Mark them as legacy or wait for maturity.");
        // }
    }

    plan.isActive = isActive;
    // plan.updatedBy = adminUserId; // Add if you have an updatedBy field
    await plan.save();
    logger.info(`Investment plan "${plan.planName}" (ID: ${planId}) status set to ${isActive ? 'Active' : 'Inactive'} by admin ${adminUserId}`);
    return plan;
};

export const deleteInvestmentPlan = async (planId, adminUserId) => {
    // Business rule: Can only delete if no investments (active or past) are tied to it.
    const investmentsCount = await Investment.countDocuments({ plan: planId });
    if (investmentsCount > 0) {
        throw new BadRequestError("Cannot delete investment plan. It has associated investments. Consider deactivating it instead.");
    }

    const result = await InvestmentPlan.findByIdAndDelete(planId);
    if (!result) {
        throw new NotFoundError(`Investment plan with ID "${planId}" not found.`);
    }
    logger.info(`Investment plan "${result.planName}" (ID: ${planId}) deleted by admin ${adminUserId}`);
    return { message: "Investment plan deleted successfully." };
};

export const getInvestmentPlanGuide = async () => {
    logger.info('[Plan Service Backend] Attempting to fetch investment plan guide.');
    try {
        const activePlans = await InvestmentPlan.find({ isActive: true })
            .sort({ 'investmentRange.minUSD': 1, 'displayOrder': 1 })
            // Using .lean({ virtuals: true }) is good for performance if it works reliably
            // for populating virtuals in your Mongoose version.
            // If virtuals are not populating, remove .lean() or ensure schema options are set.
            .lean({ virtuals: true }); // Explicitly ask for virtuals with lean

        if (!activePlans) { // find returns [] if no docs, not null, but defensive check
            logger.warn("[Plan Service Backend] InvestmentPlan.find returned null or undefined (unexpected).");
            return [];
        }

        logger.info(`[Plan Service Backend] Found ${activePlans.length} active plans.`);

        // The 'illustrations' virtual should now be part of each plan object
        // due to .lean({ virtuals: true }) and schema options.
        // We can add periodDays directly for clarity in the guide.
        const planGuide = activePlans.map(plan => {
            if (!plan.illustrations) { // Defensive check if virtual didn't populate
                logger.warn(`[Plan Service Backend] Plan "${plan.planName}" (ID: ${plan._id}) missing 'illustrations' virtual. Check model schema and lean options.`);
            }
            return {
                ...plan, // Spread all properties, including virtuals like 'illustrations'
                periodDays: plan.durationDays, // Explicitly add for clarity in guide
                // Ensure the frontend expects 'illustrativeExamples' or 'illustrations'
                // If frontend expects 'illustrativeExamples', map it here:
                // illustrativeExamples: plan.illustrations || [],
            };
        });

        logger.info(`[Plan Service Backend] Plan guide data prepared with ${planGuide.length} plans.`);
        return planGuide; // This will be the 'data' part of the API response
    } catch (error) {
        logger.error("[Plan Service Backend] CRITICAL ERROR fetching investment plan guide:", error);
        throw error; // Re-throw to be caught by asyncHandler and global error handler
    }
};

// Ensure other plan service functions like getActiveInvestmentPlansForUser are also robust
// export const getActiveInvestmentPlansForUser = async () => {
//     logger.info('[Plan Service Backend] Attempting to fetch active investment plans for user view.');
//     try {
//         return await InvestmentPlan.find({ isActive: true })
//             .sort({ 'investmentRange.minUSD': 1, 'displayOrder': 1 })
//             .lean({ virtuals: true }); // Also use virtuals here for consistency if needed
//     } catch (error) {
//         logger.error("[Plan Service Backend] Error fetching active plans for user view:", error);
//         throw error;
//     }
// };
