// src/models/Investment.model.js
import mongoose from 'mongoose';
import { INVESTMENT_STATUS, SUPPORTED_CRYPTO_SYMBOLS } from '../constants/index.js';

const investmentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        plan: { // Reference to the specific plan chosen
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InvestmentPlan',
            required: true,
        },
        // Snapshots of plan details at the time of investment
        // This is important if plan details can change later
        planNameSnapshot: { type: String, required: true },
        dailyROIPercentageSnapshot: { type: Number, required: true },
        durationDaysSnapshot: { type: Number, required: true },

        investedAmountUSD: {
            type: Number,
            required: [true, "Invested amount in USD is required"],
            min: [0, "Investment amount cannot be negative"],
        },
        paymentCryptocurrency: {
            type: String,
            required: [true, "Payment cryptocurrency is required"],
            enum: SUPPORTED_CRYPTO_SYMBOLS,
        },
        paymentAmountCrypto: { // The actual amount of crypto sent by the user
            type: Number,
            required: [true, "Payment amount in crypto is required"],
        },
        cryptoToUSDRateSnapshot: { // e.g., 1 BTC = 50000 USD at time of investment
            type: Number,
            required: [true, "Crypto to USD rate snapshot is required"],
        },
        transactionId: { // User-provided TXID for their deposit
            type: String,
            trim: true,
            // unique: true, // Can be unique if you want to prevent re-use of TXID
            // required: [true, "Transaction ID (TXID) is required for verification"],
        },
        platformReceivingWalletAddress: { // The platform's wallet address user sent funds to
            type: String,
            required: true,
        },
        investmentDate: { // Date when the investment was initiated by the user
            type: Date,
            default: Date.now,
        },
        activationDate: { // Date when admin verified and activated the investment
            type: Date,
            index: true,
        },
        maturityDate: { // Calculated: activationDate + durationDaysSnapshot
            type: Date,
            index: true,
        },
        // Calculated values based on snapshots
        expectedDailyProfitUSD: { type: Number },
        expectedTotalProfitUSD: { type: Number },
        expectedTotalReturnUSD: { type: Number }, // Invested Amount + Total Profit

        currentProfitUSD: { // Could be updated by a cron job daily
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: Object.values(INVESTMENT_STATUS),
            default: INVESTMENT_STATUS.PENDING_VERIFICATION,
            index: true,
        },
        isReinvestEnabled: { // User's choice for this specific investment
            type: Boolean,
            default: false,
        },
        verificationTimestamp: { type: Date }, // When admin verified the TXID
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Admin user
        },
        adminNotes: { type: String, trim: true }, // Admin notes on verification or issues
    },
    {
        timestamps: true,
    }
);

// Pre-save hook to calculate expected profits and maturity date
investmentSchema.pre('save', function (next) {
    if (this.isModified('investedAmountUSD') || this.isModified('dailyROIPercentageSnapshot') || this.isModified('durationDaysSnapshot')) {
        if (this.investedAmountUSD && this.dailyROIPercentageSnapshot) {
            this.expectedDailyProfitUSD = (this.investedAmountUSD * this.dailyROIPercentageSnapshot) / 100;
            if (this.durationDaysSnapshot) {
                this.expectedTotalProfitUSD = this.expectedDailyProfitUSD * this.durationDaysSnapshot;
                this.expectedTotalReturnUSD = this.investedAmountUSD + this.expectedTotalProfitUSD;
            }
        }
    }
    if (this.isModified('activationDate') && this.activationDate && this.durationDaysSnapshot) {
        const maturity = new Date(this.activationDate);
        maturity.setDate(maturity.getDate() + this.durationDaysSnapshot);
        this.maturityDate = maturity;
    }
    next();
});


investmentSchema.virtual('calculatedCurrentProfitUSD').get(function () {
    if (this.status !== INVESTMENT_STATUS.ACTIVE || !this.activationDate) {
        return 0;
    }

    const activationDate = new Date(this.activationDate);
    const today = new Date(); // Current moment
    const maturityDate = new Date(this.maturityDate);

    // If today is before activation or after maturity, no active profit accrues today
    if (today < activationDate || today > maturityDate) {
        // If past maturity but somehow still "Active", should show expectedTotalProfit
        // But for "current" active profit, it's 0 if outside active window
        return 0;
    }

    // Calculate the number of full 24-hour periods passed since activation up to "today"
    // or up to maturity if "today" is past maturity (though status check above handles this).
    const effectiveEndDateForProfitCalc = today < maturityDate ? today : maturityDate;

    // Milliseconds from activation to the effective end for profit calculation
    const msSinceActivation = effectiveEndDateForProfitCalc.getTime() - activationDate.getTime();

    if (msSinceActivation < 0) return 0; // Should not happen if activationDate <= today

    // Number of full 24-hour periods.
    // Example: if activated at 10:00 AM, first profit accrues at 10:00 AM next day.
    // So, 23 hours in = 0 full days. 25 hours in = 1 full day.
    const fullDaysPassed = Math.floor(msSinceActivation / (1000 * 60 * 60 * 24));

    // Profit is earned for each *completed* full day.
    // Cap this at the total duration of the plan.
    const daysForProfit = Math.min(fullDaysPassed, this.durationDaysSnapshot);

    if (daysForProfit < 0) return 0; // Should not happen

    const dailyProfit = (this.investedAmountUSD * this.dailyROIPercentageSnapshot) / 100;
    const accruedProfit = dailyProfit * daysForProfit;

    return parseFloat(accruedProfit.toFixed(2));
});

// Ensure schema options include virtuals for toJSON and toObject
investmentSchema.set('toJSON', { virtuals: true });
investmentSchema.set('toObject', { virtuals: true });


// Index for querying active investments needing status updates (e.g., maturity checks)
investmentSchema.index({ status: 1, maturityDate: 1 });
investmentSchema.index({ user: 1, status: 1 });

const Investment = mongoose.model('Investment', investmentSchema);
export default Investment;