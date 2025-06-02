// src/models/InvestmentPlan.model.js
import mongoose from 'mongoose';

const investmentPlanSchema = new mongoose.Schema(
    {
        planName: {
            type: String,
            required: [true, "Plan name is required"],
            trim: true,
            unique: true,
        },
        description: {
            type: String,
            trim: true,
        },
        investmentRange: {
            minUSD: {
                type: Number,
                required: [true, "Minimum investment amount in USD is required"],
                min: [0, "Minimum investment cannot be negative"],
            },
            maxUSD: {
                type: Number,
                required: [true, "Maximum investment amount in USD is required"],
                validate: {
                    validator: function (value) {
                        // this.investmentRange.minUSD might not be set yet during initial creation if maxUSD is set first
                        // It's better to validate this at the controller level or ensure minUSD is always present
                        return value >= (this.get('investmentRange.minUSD') || 0);
                    },
                    message: 'Maximum investment must be greater than or equal to minimum investment.',
                },
            },
        },
        dailyROIPercentage: { // Storing as a whole number, e.g., 3 for 3%
            type: Number,
            required: [true, "Daily ROI percentage is required"],
            min: [0, "ROI percentage cannot be negative"],
        },
        durationDays: {
            type: Number,
            required: [true, "Duration in days is required"],
            min: [1, "Duration must be at least 1 day"],
            integer: true,
        },
        // Example: The blueprint specific plans were:
        // Basic: 3% daily for 7 days
        // Gold: 3.5% daily for 30 days
        // Executive: 4% daily for 90 days
        // These would be instances of this model.

        reinvestmentOptionAvailable: { // Whether users can opt for auto-reinvestment with this plan
            type: Boolean,
            default: true,
        },
        isActive: { // Admin can deactivate a plan
            type: Boolean,
            default: true,
            index: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Admin user
            // required: true, // Good practice
        },
        tags: [String], // For categorization, e.g., ['Short-term', 'High-yield']
    },
    {
        timestamps: true,
    }
);

// Calculate total ROI based on daily ROI and duration
investmentPlanSchema.virtual('totalROIPercentage').get(function () {
    if (this.dailyROIPercentage && this.durationDays) {
        return this.dailyROIPercentage * this.durationDays;
    }
    return 0;
});

// Ensure virtuals are included in JSON output
investmentPlanSchema.set('toJSON', { virtuals: true });
investmentPlanSchema.set('toObject', { virtuals: true });

const InvestmentPlan = mongoose.model('InvestmentPlan', investmentPlanSchema);
export default InvestmentPlan;