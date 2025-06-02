// src/services/analytics.service.js
import { User, Investment, Withdrawal, Log, InvestmentPlan, Transaction, SupportedCrypto } from '../models/index.js';
import logger from '../utils/logger.util.js';
import { USER_ROLES, 
    ACCOUNT_STATUS, 
    INVESTMENT_STATUS, 
    TRANSACTION_TYPES, 
    SUPPORTED_CRYPTO_SYMBOLS,
    TRANSACTION_STATUS,
    WITHDRAWAL_STATUS,
    CHAT_SESSION_STATUS,
} from '../constants/index.js';
import mongoose from 'mongoose';
// import moment from 'moment'; // yarn add moment - Useful for date manipulations


// Helper for date ranges
const getDateRange = (period) => {
    const end = new Date();
    let start;
    switch (period) {
        case 'daily':
            start = new Date(end);
            start.setHours(0, 0, 0, 0);
            break;
        case 'weekly':
            start = new Date(end);
            start.setDate(end.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            break;
        case 'monthly':
            start = new Date(end);
            start.setMonth(end.getMonth() - 1);
            start.setHours(0, 0, 0, 0);
            break;
        case 'yearly':
            start = new Date(end);
            start.setFullYear(end.getFullYear() - 1);
            start.setHours(0, 0, 0, 0);
            break;
        default: // Default to last 30 days if period is unrecognized
            start = new Date(end);
            start.setDate(end.getDate() - 30);
            start.setHours(0, 0, 0, 0);
            break;
    }
    return { start, end };
};


// Helper to get the start of the day in UTC
// Helper for date ranges (ensure this is defined or imported if used elsewhere)
const getStartOfDayUTC = (date) => {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

// --- User Dashboard Analytics ---

export const getUserInvestmentPortfolioValueHistory = async (userId, periodDays = 30) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    logger.info(`[Analytics Service Backend] Generating portfolio history for user ${userId} for ${periodDays} days.`);

    const endDate = new Date(); // Today (end of the chart period)
    const chartStartDate = getStartOfDayUTC(new Date(new Date().setDate(endDate.getDate() - periodDays))); // Start of the first day in the period

    // Fetch all relevant transactions for the user up to the endDate of our chart period.
    // This helps establish the portfolio value at the beginning of the chart period.
    const allUserTransactions = await Transaction.find({
        user: userObjectId,
        type: { $in: [TRANSACTION_TYPES.DEPOSIT, TRANSACTION_TYPES.ROI_PAYOUT, TRANSACTION_TYPES.WITHDRAWAL] },
        status: { $in: ['Completed', 'Verified'] }, // Only completed/verified transactions
        createdAt: { $lte: endDate } // Transactions up to the end of the chart period
    }).sort({ createdAt: 'asc' }).lean();

    const chartData = {
        labels: [], // Dates (YYYY-MM-DD)
        values: [], // Portfolio values for those dates
    };

    let currentPortfolioValue = 0;
    let transactionIdx = 0;

    // 1. Calculate the portfolio value *before* the chart's actual start date (chartStartDate)
    // This gives us the starting balance for the first day of the chart.
    while (transactionIdx < allUserTransactions.length && new Date(allUserTransactions[transactionIdx].createdAt) < chartStartDate) {
        const tx = allUserTransactions[transactionIdx];
        if (tx.type === TRANSACTION_TYPES.DEPOSIT || tx.type === TRANSACTION_TYPES.ROI_PAYOUT) {
            currentPortfolioValue += tx.amountUSD;
        } else if (tx.type === TRANSACTION_TYPES.WITHDRAWAL) {
            currentPortfolioValue -= tx.amountUSD;
        }
        transactionIdx++;
    }

    // 2. Iterate daily through the desired chart period
    for (let dayOffset = 0; dayOffset <= periodDays; dayOffset++) {
        const currentDateIter = new Date(chartStartDate);
        currentDateIter.setUTCDate(chartStartDate.getUTCDate() + dayOffset); // Iterate by day in UTC
        const endOfCurrentDayIter = new Date(currentDateIter);
        endOfCurrentDayIter.setUTCHours(23, 59, 59, 999);

        // Accumulate transactions that occurred *on or before* this specific currentDateIter
        // but *after* the transactions already processed for the initial balance.
        while (transactionIdx < allUserTransactions.length && new Date(allUserTransactions[transactionIdx].createdAt) <= endOfCurrentDayIter) {
            const tx = allUserTransactions[transactionIdx];
            if (tx.type === TRANSACTION_TYPES.DEPOSIT || tx.type === TRANSACTION_TYPES.ROI_PAYOUT) {
                currentPortfolioValue += tx.amountUSD;
            } else if (tx.type === TRANSACTION_TYPES.WITHDRAWAL) {
                currentPortfolioValue -= tx.amountUSD;
            }
            transactionIdx++;
        }

        // For this simplified transaction-based history, this is the value for the day.
        // To include active investments' unrealized profit, that logic would be added here for each day.
        // For now, let's proceed with this transaction-based value.

        chartData.labels.push(currentDateIter.toISOString().split('T')[0]); // YYYY-MM-DD
        chartData.values.push(parseFloat(currentPortfolioValue.toFixed(2)));
    }

    // The `currentValueUSD` returned should reflect the most up-to-date portfolio value,
    // which might include active investments' principal and their current unrealized profit.
    // The chart plots historical values based on transactions.
    // For a more comprehensive `currentValueUSD`, you'd re-calculate it as done previously:
    let finalLiveCurrentValueUSD = 0;
    const allTransactionsForFinalValue = await Transaction.find({ // Could reuse allUserTransactions if appropriate
        user: userObjectId,
        type: { $in: [TRANSACTION_TYPES.DEPOSIT, TRANSACTION_TYPES.ROI_PAYOUT, TRANSACTION_TYPES.WITHDRAWAL] },
        status: { $in: ['Completed', 'Verified'] },
    }).lean();
    allTransactionsForFinalValue.forEach(tx => {
        if (tx.type === TRANSACTION_TYPES.DEPOSIT || tx.type === TRANSACTION_TYPES.ROI_PAYOUT) finalLiveCurrentValueUSD += tx.amountUSD;
        else if (tx.type === TRANSACTION_TYPES.WITHDRAWAL) finalLiveCurrentValueUSD -= tx.amountUSD;
    });

    const currentActiveInvestments = await Investment.find({
        user: userObjectId,
        status: INVESTMENT_STATUS.ACTIVE
    }).lean();

    currentActiveInvestments.forEach(inv => {
        finalLiveCurrentValueUSD += inv.investedAmountUSD; // Principal of active investments
        // Add current accrued profit of active investments
        // This requires inv.currentProfitUSD to be accurately updated by a cron job,
        // or calculated on the fly based on how long it's been active today.
        let accruedProfit = 0;
        if (inv.currentProfitUSD) { // If updated by cron
            accruedProfit = inv.currentProfitUSD;
        } else if (inv.activationDate) { // Fallback: calculate based on days active
            const activationDate = new Date(inv.activationDate);
            const today = new Date();
            // Ensure activationDate is not in the future relative to 'today' for calculation
            if (activationDate <= today) {
                let daysActive = Math.floor((today.getTime() - activationDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                daysActive = Math.min(daysActive, inv.durationDaysSnapshot);
                daysActive = Math.max(0, daysActive); // Ensure non-negative
                const dailyProfit = (inv.investedAmountUSD * inv.dailyROIPercentageSnapshot) / 100;
                accruedProfit = dailyProfit * daysActive;
            }
        }
        finalLiveCurrentValueUSD += accruedProfit;
    });


    return {
        currentValueUSD: parseFloat(finalLiveCurrentValueUSD.toFixed(2)), // This is the "live" total value
        chartData: chartData // This is the historical data for the chart
    };
};



export const getUserInvestmentPortfolioValue = async (userId, periodDays = 30) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Determine the date range for the chart
    const endDate = new Date(); // Today
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - periodDays);
    const chartStartDate = getStartOfDay(startDate); // Start of the first day in the period

    // 2. Fetch all relevant transactions for the user within a broader range to establish starting balance
    // We fetch transactions from the beginning of time up to the endDate of our chart period.
    const allUserTransactions = await Transaction.find({
        user: userObjectId,
        type: { $in: [TRANSACTION_TYPES.DEPOSIT, TRANSACTION_TYPES.ROI_PAYOUT, TRANSACTION_TYPES.WITHDRAWAL] },
        status: { $in: ['Completed', 'Verified'] }, // Consider only completed/verified transactions
        createdAt: { $lte: endDate } // All transactions up to the end of the chart period
    }).sort({ createdAt: 'asc' }).lean();


    const chartData = {
        labels: [], // Dates
        values: [], // Portfolio values
    };

    let currentValue = 0;
    let transactionIndex = 0;

    // Calculate the portfolio value *before* the chart's start date
    // This gives us the starting point for our chart if user had activity before the period.
    for (let i = 0; i < allUserTransactions.length; i++) {
        const tx = allUserTransactions[i];
        if (new Date(tx.createdAt) < chartStartDate) {
            if (tx.type === TRANSACTION_TYPES.DEPOSIT || tx.type === TRANSACTION_TYPES.ROI_PAYOUT) {
                currentValue += tx.amountUSD;
            } else if (tx.type === TRANSACTION_TYPES.WITHDRAWAL) {
                currentValue -= tx.amountUSD;
            }
            transactionIndex = i + 1; // Move index past already processed transactions
        } else {
            break; // Stop once we reach transactions within our chart period
        }
    }

    // 3. Iterate daily through the desired chart period
    for (let day = 0; day <= periodDays; day++) {
        const currentDateIter = new Date(chartStartDate);
        currentDateIter.setDate(chartStartDate.getDate() + day);
        const endOfCurrentDayIter = new Date(currentDateIter);
        endOfCurrentDayIter.setUTCHours(23, 59, 59, 999);


        // Process transactions that occurred on this specific day
        while (transactionIndex < allUserTransactions.length && new Date(allUserTransactions[transactionIndex].createdAt) <= endOfCurrentDayIter) {
            const tx = allUserTransactions[transactionIndex];
            if (tx.type === TRANSACTION_TYPES.DEPOSIT || tx.type === TRANSACTION_TYPES.ROI_PAYOUT) {
                currentValue += tx.amountUSD;
            } else if (tx.type === TRANSACTION_TYPES.WITHDRAWAL) {
                currentValue -= tx.amountUSD;
            }
            transactionIndex++;
        }

        // --- Optional: Add unrealized profits from ACTIVE investments ---
        // This makes the chart reflect "current potential value" including ongoing investments.
        // This part can be performance-intensive if there are many active investments.
        let unrealizedActiveProfit = 0;
        const activeInvestments = await Investment.find({
            user: userObjectId,
            status: INVESTMENT_STATUS.ACTIVE,
            activationDate: { $lte: endOfCurrentDayIter } // Activated on or before this day
        }).lean();

        activeInvestments.forEach(inv => {
            const activationDate = new Date(inv.activationDate);
            // Calculate how many days the investment has been active up to 'currentDateIter'
            let daysActive = Math.floor((currentDateIter.getTime() - activationDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            daysActive = Math.min(daysActive, inv.durationDaysSnapshot); // Cap at plan duration
            daysActive = Math.max(0, daysActive); // Ensure non-negative

            const dailyProfit = (inv.investedAmountUSD * inv.dailyROIPercentageSnapshot) / 100;
            const accruedProfitForDay = dailyProfit * daysActive;

            // This is a simple accrual. A more accurate currentProfitUSD might be stored on the inv model.
            // We also need to ensure we don't double-count if ROI_PAYOUT transactions are already accounting for this.
            // For this logic to be accurate with ROI_PAYOUT, ROI_PAYOUT should only happen at full maturity.
            unrealizedActiveProfit += (inv.investedAmountUSD + accruedProfitForDay);
        });
        // If we add unrealizedActiveProfit, the 'currentValue' from transactions should mainly be cash/withdrawable balance.
        // So, portfolio value = cash_balance + value_of_active_investments_with_accrued_profit
        // For now, let's make the currentValue track the cash-like balance from transactions,
        // and add the value of active investments separately.
        // This approach is simpler: portfolio value = SUM(deposits) + SUM(realized_roi) - SUM(withdrawals)
        // + SUM(current value of active investments [principal + accrued unrealized profit])

        // For simplicity of the primary logic, let's stick to *realized* values based on transactions for now.
        // Adding unrealized profit from active investments accurately for each day in the past is complex.
        // A simpler chart might just plot currentValue (based on transactions).
        // A more comprehensive one would add the current value of active investments (principal + daily accrued profit)
        // to `currentValue` for each day.

        // Let's use the simpler transaction-based value for now.
        chartData.labels.push(currentDateIter.toISOString().split('T')[0]); // YYYY-MM-DD
        chartData.values.push(parseFloat(currentValue.toFixed(2)));
    }

    // Get the absolute current portfolio value (including active investments' current profit)
    // This can be slightly different from the last point in chart if daily profit accrual is complex.
    let finalCurrentValue = 0;
    const finalTransactions = await Transaction.find({
        user: userObjectId,
        type: { $in: [TRANSACTION_TYPES.DEPOSIT, TRANSACTION_TYPES.ROI_PAYOUT, TRANSACTION_TYPES.WITHDRAWAL] },
        status: { $in: ['Completed', 'Verified'] },
    }).lean();
    finalTransactions.forEach(tx => {
        if (tx.type === TRANSACTION_TYPES.DEPOSIT || tx.type === TRANSACTION_TYPES.ROI_PAYOUT) finalCurrentValue += tx.amountUSD;
        else if (tx.type === TRANSACTION_TYPES.WITHDRAWAL) finalCurrentValue -= tx.amountUSD;
    });

    const currentActiveInvestments = await Investment.find({
        user: userObjectId,
        status: INVESTMENT_STATUS.ACTIVE
    }).lean();
    currentActiveInvestments.forEach(inv => {
        // Add principal of active investments
        finalCurrentValue += inv.investedAmountUSD;
        // Add current accrued profit of active investments
        // This requires inv.currentProfitUSD to be accurately updated by a cron job,
        // or calculated on the fly based on how long it's been active today.
        // For simplicity, using `inv.currentProfitUSD` if available.
        let accruedProfit = 0;
        if (inv.currentProfitUSD) {
            accruedProfit = inv.currentProfitUSD;
        } else { // Fallback: calculate based on days active
            const activationDate = new Date(inv.activationDate);
            let daysActive = Math.floor((new Date().getTime() - activationDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            daysActive = Math.min(daysActive, inv.durationDaysSnapshot);
            daysActive = Math.max(0, daysActive);
            const dailyProfit = (inv.investedAmountUSD * inv.dailyROIPercentageSnapshot) / 100;
            accruedProfit = dailyProfit * daysActive;
        }
        finalCurrentValue += accruedProfit;
    });


    return {
        // currentValueUSD: parseFloat(currentValue.toFixed(2)), // This is the value at the end of the chart period
        currentValueUSD: parseFloat(finalCurrentValue.toFixed(2)), // A more "live" current value
        chartData: chartData
    };
};

// export const getUserCoinUsageBreakdown = async (userId) => {
//     const result = await Investment.aggregate([
//         { $match: { user: new mongoose.Types.ObjectId(userId) } },
//         {
//             $group: {
//                 _id: '$paymentCryptocurrency',
//                 totalInvestedUSD: { $sum: '$investedAmountUSD' },
//                 count: { $sum: 1 }
//             }
//         },
//         { $project: { _id: 0, coin: '$_id', totalInvestedUSD: 1, count: 1 } },
//         { $sort: { totalInvestedUSD: -1 } }
//     ]);
//     return result;
// };

export const getUserCoinUsageBreakdown = async (userId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    logger.info(`[Analytics Service Backend] Getting coin usage breakdown for user ${userId}`);
    try {
        const result = await Investment.aggregate([
            { $match: { user: userObjectId } }, // Filter by user
            {
                $group: {
                    _id: '$paymentCryptocurrency', // Group by the crypto they paid with
                    totalInvestedUSD: { $sum: '$investedAmountUSD' },
                    count: { $sum: 1 } // Number of investments with this coin
                }
            },
            { 
                $project: { 
                    _id: 0, // Remove the default _id group field from output
                    coin: '$_id', // Rename _id to coin
                    totalInvestedUSD: 1, 
                    count: 1 
                } 
            },
            { $sort: { totalInvestedUSD: -1 } } // Sort by most invested
        ]);
        logger.info(`[Analytics Service Backend] Coin usage for user ${userId}:`, result);
        return result; // This returns an array of objects
    } catch (error) {
        logger.error(`[Analytics Service Backend] Error getting coin usage for user ${userId}:`, error);
        throw error; // Re-throw for the controller to handle
    }
};

export const getUserActivityLog = async (userId, page = 1, limit = 10) => {
    const logs = await Log.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('eventType message createdAt ipAddress -_id') // Select relevant fields
        .lean();
    const totalLogs = await Log.countDocuments({ user: userId });
    return {
        logs,
        totalPages: Math.ceil(totalLogs / limit),
        currentPage: page,
        totalLogs
    };
};


// --- Admin Analytics ---

export const getPlatformUserStats = async () => {
    const totalUsers = await User.countDocuments({ role: USER_ROLES.INVESTOR });
    const activeUsers = await User.countDocuments({ role: USER_ROLES.INVESTOR, status: 'Active' });

    // For growth trend, you'd group users by registration date (e.g., daily/weekly/monthly)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsersLast30Days = await User.countDocuments({ role: USER_ROLES.INVESTOR, createdAt: { $gte: thirtyDaysAgo } });

    return {
        totalUsers,
        activeUsers,
        newUsersLast30Days,
        // More detailed growthTrend would be an array of {date, count}
    };
};

export const getPlatformInvestmentStats = async () => {
    const totalInvestedResult = await Investment.aggregate([
        { $match: { status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED, INVESTMENT_STATUS.WITHDRAWN] } } },
        {
            $group: {
                _id: null,
                totalInvestedUSD: { $sum: '$investedAmountUSD' },
                totalInvestmentsCount: { $sum: 1 }
            }
        }
    ]);
    const totalInvestedUSD = totalInvestedResult.length > 0 ? totalInvestedResult[0].totalInvestedUSD : 0;
    const totalInvestmentsCount = totalInvestedResult.length > 0 ? totalInvestedResult[0].totalInvestmentsCount : 0;

    const investmentByCoin = await Investment.aggregate([
        { $match: { status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED, INVESTMENT_STATUS.WITHDRAWN] } } },
        {
            $group: {
                _id: '$paymentCryptocurrency',
                totalUSDValue: { $sum: '$investedAmountUSD' },
                totalCryptoAmount: { $sum: '$paymentAmountCrypto' } // Summing crypto amounts directly can be misleading if prices varied
            }
        },
        { $project: { _id: 0, coin: '$_id', totalUSDValue: 1, totalCryptoAmount: 1 } }
    ]);

    const activeInvestmentsCount = await Investment.countDocuments({ status: INVESTMENT_STATUS.ACTIVE });
    const maturedInvestmentsCount = await Investment.countDocuments({ status: INVESTMENT_STATUS.MATURED });

    return {
        totalInvestedUSD: parseFloat(totalInvestedUSD.toFixed(2)),
        totalInvestmentsCount,
        investmentByCoin,
        activeInvestmentsCount,
        maturedInvestmentsCount,
    };
};

export const getPlatformPlanPopularity = async () => {
    const planPopularity = await Investment.aggregate([
        { $group: { _id: '$planNameSnapshot', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, planName: '$_id', investmentCount: '$count' } }
    ]);
    return planPopularity;
};

export const getSystemROIOwed = async () => {
    // Sum of (expectedTotalProfitUSD - (what's already been paid out in withdrawals related to ROI))
    // for ACTIVE and MATURED investments. This is complex.
    // Simplified: Sum of expectedTotalProfitUSD for ACTIVE investments + remaining profits for MATURED ones.

    let roiOwed = 0;
    const activeInvestments = await Investment.find({ status: INVESTMENT_STATUS.ACTIVE }).lean();
    activeInvestments.forEach(inv => {
        roiOwed += inv.expectedTotalProfitUSD || 0; // Profit for the entire duration
    });

    const maturedInvestments = await Investment.find({ status: INVESTMENT_STATUS.MATURED }).lean();
    for (const inv of maturedInvestments) {
        const paidTransactions = await Transaction.find({
            relatedInvestment: inv._id,
            type: TRANSACTION_TYPES.ROI_PAYOUT, // Or WITHDRAWAL if it's directly linked
            status: TRANSACTION_STATUS.COMPLETED
        }).lean();
        let paidAmount = 0;
        paidTransactions.forEach(t => paidAmount += t.amountUSD);
        roiOwed += Math.max(0, (inv.expectedTotalProfitUSD || 0) - paidAmount);
    }
    return parseFloat(roiOwed.toFixed(2));
};

export const getWithdrawalTrends = async (period = 'monthly') => {
    const { start, end } = getDateRange(period);
    const result = await Withdrawal.aggregate([
        { $match: { requestDate: { $gte: start, $lte: end }, status: WITHDRAWAL_STATUS.COMPLETED } },
        {
            $group: {
                _id: '$cryptocurrency',
                totalUSDWithdrawn: { $sum: '$amountUSD' },
                totalCryptoWithdrawn: { $sum: '$amountCrypto' }, // Summing crypto amounts of different types isn't ideal here
                count: { $sum: 1 }
            }
        },
        { $project: { _id: 0, coin: '$_id', totalUSDWithdrawn: 1, totalCryptoWithdrawn: 1, count: 1 } },
        { $sort: { totalUSDWithdrawn: -1 } }
    ]);

    const totalWithdrawalsUSDThisPeriod = result.reduce((sum, item) => sum + item.totalUSDWithdrawn, 0);

    return {
        period,
        trendsByCoin: result,
        totalWithdrawalsUSDThisPeriod: parseFloat(totalWithdrawalsUSDThisPeriod.toFixed(2))
    };
};

export const getUserLeaderboardByVolume = async (limit = 10) => {
    const leaderboard = await Investment.aggregate([
        { $match: { status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED, INVESTMENT_STATUS.WITHDRAWN] } } },
        {
            $group: {
                _id: '$user',
                totalInvestedVolumeUSD: { $sum: '$investedAmountUSD' }
            }
        },
        { $sort: { totalInvestedVolumeUSD: -1 } },
        { $limit: limit },
        {
            $lookup: { // Populate user details
                from: 'users', // collection name
                localField: '_id',
                foreignField: '_id',
                as: 'userDetails'
            }
        },
        { $unwind: '$userDetails' }, // $lookup returns an array
        {
            $project: {
                _id: 0,
                userId: '$_id',
                email: '$userDetails.email',
                fullName: '$userDetails.fullName',
                totalInvestedVolumeUSD: 1
            }
        }
    ]);
    return leaderboard;
};

// NEW FUNCTION FOR USER DASHBOARD METRICS
export const getUserDashboardSummary = async (userId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    logger.info(`[Analytics Service Backend] Getting dashboard summary for user ${userId}`);

    try {
        const userInvestments = await Investment.find({ user: userObjectId }).lean({ virtuals: true });

        let totalPrincipalInvestedActive = 0;
        let totalCurrentAccruedProfitActive = 0;
        let activeInvestmentsCount = 0;

        let totalProfitFromMaturedOrWithdrawn = 0;
        let availableProfitFromMaturedUnpaid = 0; // Profit from matured plans not yet part of a completed withdrawal

        for (const inv of userInvestments) {
            if (inv.status === INVESTMENT_STATUS.ACTIVE) {
                activeInvestmentsCount++;
                totalPrincipalInvestedActive += inv.investedAmountUSD || 0;

                // Calculate current accrued profit for active investments
                let currentProfit = 0;
                if (inv.currentProfitUSD) { // If cron job updates this
                    currentProfit = inv.currentProfitUSD;
                } else if (inv.activationDate) { // Fallback calculation
                    const activationDate = new Date(inv.activationDate);
                    const today = new Date();
                    if (activationDate <= today) {
                        let daysActive = Math.floor((today.getTime() - activationDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        daysActive = Math.min(daysActive, inv.durationDaysSnapshot);
                        daysActive = Math.max(0, daysActive);
                        const dailyProfit = (inv.investedAmountUSD * inv.dailyROIPercentageSnapshot) / 100;
                        currentProfit = dailyProfit * daysActive;
                    }
                }
                totalCurrentAccruedProfitActive += currentProfit;
            } else if (inv.status === INVESTMENT_STATUS.MATURED || inv.status === INVESTMENT_STATUS.WITHDRAWN) {
                totalProfitFromMaturedOrWithdrawn += inv.expectedTotalProfitUSD || 0;
            }

            if (inv.status === INVESTMENT_STATUS.MATURED) {
                // Check how much of this matured profit has been paid out via ROI_PAYOUT or WITHDRAWAL transactions
                const paidOutTransactions = await Transaction.find({
                    user: userObjectId,
                    relatedInvestment: inv._id, // Assuming direct link or withdrawal links to investment
                    type: { $in: [TRANSACTION_TYPES.ROI_PAYOUT, TRANSACTION_TYPES.WITHDRAWAL] }, // Consider both
                    status: TRANSACTION_STATUS.COMPLETED
                }).lean();

                let amountAlreadyPaidFromThisInvestmentProfit = 0;
                // This logic is tricky: a single withdrawal might cover profits from multiple investments.
                // For simplicity, if ROI_PAYOUT transactions are created upon maturity for the profit,
                // we check against those.
                const roiPayoutTx = await Transaction.findOne({
                    user: userObjectId,
                    relatedInvestment: inv._id,
                    type: TRANSACTION_TYPES.ROI_PAYOUT,
                    status: { $ne: TRANSACTION_STATUS.COMPLETED } // Find pending/verified but not yet fully withdrawn via a final WITHDRAWAL tx
                }).lean();

                if (roiPayoutTx && (roiPayoutTx.status === TRANSACTION_STATUS.PENDING || roiPayoutTx.status === TRANSACTION_STATUS.VERIFIED)) {
                    availableProfitFromMaturedUnpaid += roiPayoutTx.amountUSD;
                } else if (!roiPayoutTx) { // No pending ROI_PAYOUT, means profit is fully available if not withdrawn
                    // This means the profit from this MATURED investment is available if not yet covered by a completed WITHDRAWAL
                    // This part is complex without a clear "available balance" field on the user.
                    // Let's assume ROI_PAYOUT transactions represent the profit becoming "available".
                }
            }
        }

        // Total Current Portfolio Value:
        // Principal of Active + Accrued Profit of Active + Available (unwithdrawn) Profit from Matured
        const totalCurrentPortfolioValue = totalPrincipalInvestedActive + totalCurrentAccruedProfitActive + availableProfitFromMaturedUnpaid;

        // Total Profit Earned:
        // Accrued Profit of Active + Total Profit from Matured/Withdrawn investments
        const totalProfitEarned = totalCurrentAccruedProfitActive + totalProfitFromMaturedOrWithdrawn;

        return {
            totalCurrentPortfolioValue: parseFloat(totalCurrentPortfolioValue.toFixed(2)),
            totalProfitEarned: parseFloat(totalProfitEarned.toFixed(2)),
            activeInvestmentsCount: activeInvestmentsCount,
            totalPrincipalInvestedActive: parseFloat(totalPrincipalInvestedActive.toFixed(2)),
            availableProfitFromMatured: parseFloat(availableProfitFromMaturedUnpaid.toFixed(2)) // Profit from matured plans that's available
        };

    } catch (error) {
        logger.error(`[Analytics Service Backend] Error getting dashboard summary for user ${userId}:`, error);
        throw error; // Let controller handle
    }
};
// Satisfaction scores would require a feedback mechanism after chat resolution.


// --- NEW OR UPDATED FUNCTIONS FOR ADMIN DASHBOARD ---
/**
 * Generates user growth data (new users per month for the last N months)
 * @param {number} months - Number of past months to include.
 * @returns {Promise<{labels: string[], values: number[]}>}
 */
export const getMonthlyUserGrowth = async (months = 6) => {
    logger.info(`[Analytics Service Backend] Getting monthly user growth for last ${months} months.`);
    const labels = [];
    const values = [];
    const today = new Date();

    for (let i = months - 1; i >= 0; i--) {
        const startDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const endDate = new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59, 999); // End of month

        labels.push(startDate.toLocaleString('default', { month: 'short', year: '2-digit' }));

        const count = await User.countDocuments({
            role: USER_ROLES.INVESTOR, // Assuming we count investors
            createdAt: { $gte: startDate, $lte: endDate }
        });
        values.push(count);
    }
    return { labels, values };
};

/**
 * Generates investment trend data (total USD invested per month for the last N months)
 * @param {number} months - Number of past months to include.
 * @returns {Promise<{labels: string[], values: number[]}>}
 */
export const getMonthlyInvestmentTrend = async (months = 6) => {
    logger.info(`[Analytics Service Backend] Getting monthly investment trend for last ${months} months.`);
    const labels = [];
    const values = [];
    const today = new Date();

    for (let i = months - 1; i >= 0; i--) {
        const startDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const endDate = new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59, 999);

        labels.push(startDate.toLocaleString('default', { month: 'short', year: '2-digit' }));

        const result = await Investment.aggregate([
            {
                $match: {
                    status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED, INVESTMENT_STATUS.WITHDRAWN] },
                    // Consider using `activationDate` if that's when an investment is truly "counted"
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalInvestedUSDInMonth: { $sum: '$investedAmountUSD' }
                }
            }
        ]);
        values.push(result.length > 0 ? parseFloat(result[0].totalInvestedUSDInMonth.toFixed(2)) : 0);
    }
    return { labels, values };
};

/**
 * Gets plan popularity based on the number of investments in each plan.
 * @returns {Promise<Array<{planName: string, investmentCount: number}>>}
 */
export const getPlanPopularityStats = async () => {
    logger.info(`[Analytics Service Backend] Getting plan popularity stats.`);
    const planPopularity = await Investment.aggregate([
        // Consider matching only specific statuses if relevant (e.g., active, matured)
        { $match: { status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED, INVESTMENT_STATUS.WITHDRAWN] } } },
        { $group: { _id: '$planNameSnapshot', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, planName: '$_id', investmentCount: '$count' } }
    ]);
    return planPopularity;
};

/**
 * Gets crypto usage statistics based on total USD value invested per cryptocurrency.
 * @returns {Promise<Array<{coin: string, totalUSDValue: number}>>}
 */
export const getCryptoUsageStats = async () => {
    logger.info(`[Analytics Service Backend] Getting crypto usage stats.`);
    const cryptoUsage = await Investment.aggregate([
        { $match: { status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED, INVESTMENT_STATUS.WITHDRAWN] } } },
        {
            $group: {
                _id: '$paymentCryptocurrency',
                totalUSDValue: { $sum: '$investedAmountUSD' }
            }
        },
        { $project: { _id: 0, coin: '$_id', totalUSDValue: { $round: ['$totalUSDValue', 2] } } }, // Round to 2 decimal places
        { $sort: { totalUSDValue: -1 } }
    ]);
    return cryptoUsage;
};


/**
 * Compiles all data for the Admin Dashboard Overview.
 * This function will call the other specific analytics functions.
 */
export const getAdminDashboardData = async () => {
    logger.info(`[Analytics Service Backend] Compiling admin dashboard overview data.`);
    try {
        const totalUsers = await User.countDocuments({ role: USER_ROLES.INVESTOR });
        const activeUsers = await User.countDocuments({ role: USER_ROLES.INVESTOR, status: ACCOUNT_STATUS.ACTIVE });

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const newUsersLast30Days = await User.countDocuments({ role: USER_ROLES.INVESTOR, createdAt: { $gte: thirtyDaysAgo } });

        const investmentStatsResult = await Investment.aggregate([
            { $match: { status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED, INVESTMENT_STATUS.WITHDRAWN] } } },
            { $group: { _id: null, totalInvestedUSD: { $sum: '$investedAmountUSD' } } }
        ]);
        const totalInvestedUSD = investmentStatsResult.length > 0 ? investmentStatsResult[0].totalInvestedUSD : 0;

        const activeInvestmentsCount = await Investment.countDocuments({ status: INVESTMENT_STATUS.ACTIVE });
        const pendingWithdrawalsCount = await Transaction.countDocuments({ type: TRANSACTION_TYPES.WITHDRAWAL, status: 'Pending' }); // Assuming status 'Pending'
        const pendingInvestmentVerifications = await Investment.countDocuments({ status: INVESTMENT_STATUS.PENDING_VERIFICATION });

        // Fetch data for charts
        const userGrowth = await getMonthlyUserGrowth(6); // Last 6 months
        const investmentTrend = await getMonthlyInvestmentTrend(6); // Last 6 months
        const planPopularity = await getPlanPopularityStats();
        const cryptoUsageStats = await getCryptoUsageStats();

        return {
            totalUsers,
            activeUsers,
            totalInvestedUSD: parseFloat(totalInvestedUSD.toFixed(2)),
            activeInvestmentsCount,
            pendingWithdrawalsCount,
            pendingInvestmentVerifications,
            newUsersLast30Days,
            userGrowth,
            investmentTrend,
            planPopularity,
            cryptoUsageStats
        };
    } catch (error) {
        logger.error("[Analytics Service Backend] CRITICAL ERROR compiling admin dashboard data:", error);
        throw error;
    }
};

export const getCombinedSupportDashboardStats = async (agentId, period) => {
    logger.info(`[Analytics Service Backend] Compiling support dashboard for agent ${agentId}, period ${period}`);
    try {
        // These functions need to be robust and return actual numbers
        const chatVolumeStats = await getSupportChatVolumeStats(period); // Ensure this is implemented
        const resolutionTimeStats = await getSupportResolutionTimeStats(period); // Ensure this is implemented
        const topUserIssues = await getSupportTopUserIssues(5, period); // Ensure this is implemented

        // Logic for myOpenTicketsCount
        let myOpenTicketsCount = 0;
        if (agentId) {
            myOpenTicketsCount = await ChatEscalation.countDocuments({
                assignedTo: new mongoose.Types.ObjectId(agentId),
                status: { $in: ['Open', 'InProgress'] } // Or just 'InProgress' if 'Open' means unassigned
            });
        }

        // Logic for totalOpenTickets
        const totalOpenTickets = await ChatEscalation.countDocuments({
            status: { $in: ['Open', 'InProgress'] }
        });

        logger.info('[Analytics Service Backend] Support Stats:', { chatVolumeStats, resolutionTimeStats, topUserIssues, myOpenTicketsCount, totalOpenTickets });

        return {
            chatVolumeStats: chatVolumeStats || { escalatedChatVolume: 0, estimatedFallbackRate: 0, period },
            resolutionTimeStats: resolutionTimeStats || { averageResolutionTimeMinutes: 0, resolvedCount: 0, period: period },
            topUserIssues: topUserIssues || [],
            myOpenTicketsCount,
            totalOpenTickets
        };
    } catch (error) {
        logger.error("[Analytics Service Backend] Error compiling support dashboard stats:", error);
        // Return default structure on error to prevent frontend from breaking on undefined properties
        return {
            chatVolumeStats: { escalatedChatVolume: 0, estimatedFallbackRate: 0, period },
            resolutionTimeStats: { averageResolutionTimeMinutes: 0, resolvedCount: 0, period },
            topUserIssues: [],
            myOpenTicketsCount: 0,
            totalOpenTickets: 0,
        };
    }
};

// NEW COMPREHENSIVE FUNCTION FOR SUPPORT DASHBOARD
export const getSupportDashboardOverviewData = async (agentId, period = 'daily') => {
    logger.info(`[Analytics Service Backend] Compiling support dashboard overview for agent ${agentId}, period ${period}.`);
    try {
        const agentObjectId = agentId ? new mongoose.Types.ObjectId(agentId) : null;

        // const openUnassignedCount = await ChatEscalation.countDocuments({
        //     status: 'Open',
        //     assignedTo: null
        // });

        const openUnassignedCount = await ChatEscalation.countDocuments({
            status: 'Open', // Strictly 'Open'
            assignedTo: { $exists: false } // Or assignedTo: null
        });

        let myOpenAssignedCount = 0;
        if (agentObjectId) {
            myOpenAssignedCount = await ChatEscalation.countDocuments({
                status: 'InProgress', // Or 'Open' if assignment doesn't auto-change status
                assignedTo: agentObjectId
            });
        }

        const chatVolumeStats = await getSupportChatVolumeStats(period);
        const resolutionTimeStats = await getSupportResolutionTimeStats(period);
        const topIssues = await getSupportTopUserIssues(5, period); // Top 5 for the period
        const escalationTrend = await getDailyEscalationTrend(period === 'weekly' ? 7 : (period === 'monthly' ? 30 : 7)); // Trend for 7 or 30 days

        return {
            openUnassignedEscalations: openUnassignedCount,
            myOpenAssignedEscalations: myOpenAssignedCount,
            totalEscalationsForPeriod: chatVolumeStats.escalatedChatVolume,
            averageResolutionTimeForPeriodMinutes: resolutionTimeStats.averageResolutionTimeMinutes,
            resolvedTicketsForPeriod: resolutionTimeStats.resolvedCount,
            escalationTrend: escalationTrend, // { labels: [], values: [] }
            topUserIssues: topIssues, // [{ tag: String, count: Number }, ...]
            period: period // Include the period for context
        };

    } catch (error) {
        logger.error("[Analytics Service Backend] CRITICAL ERROR compiling support dashboard data:", error);
        throw error;
    }
};

// // Helper for date ranges (ensure this is defined or imported)
// const getDateRange = (period) => {
//     const end = new Date(); // Current moment for "end" of period calculation
//     let start;
//     switch (period) {
//         case 'weekly':
//             start = new Date(end);
//             start.setDate(end.getDate() - 7);
//             start.setHours(0, 0, 0, 0); // Start of 7 days ago
//             break;
//         case 'monthly':
//             start = new Date(end);
//             start.setMonth(end.getMonth() - 1);
//             start.setHours(0, 0, 0, 0); // Start of 30 days ago
//             break;
//         case 'daily':
//         default: // Last 24 hours or "today"
//             start = new Date();
//             start.setHours(0, 0, 0, 0); // Start of current day
//             // end is current time by default if not explicitly set to end of day
//             break;
//     }
//     return { start, end: new Date() }; // end is now for queries up to current moment
// };

/**
 * Generates chat initiation trend data (new ChatSessions per day for the last N days)
 */
export const getDailyChatSessionTrend = async (days = 7) => {
    logger.info(`[Analytics Service Backend] Getting daily chat session trend for last ${days} days.`);
    const labels = [];
    const values = [];
    const today = getStartOfDayUTC(new Date()); // Use UTC helper for consistency

    for (let i = days - 1; i >= 0; i--) {
        const targetDate = new Date(today);
        targetDate.setUTCDate(today.getUTCDate() - i); // Go back i days

        const dayStart = new Date(targetDate); // Already start of day in UTC
        const dayEnd = new Date(targetDate);
        dayEnd.setUTCHours(23, 59, 59, 999);

        labels.push(dayStart.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }));

        const count = await ChatSession.countDocuments({
            startTime: { $gte: dayStart, $lte: dayEnd } // Based on when chat was initiated
        });
        values.push(count);
    }
    return { labels, values };
};

/**
 * Gets top issues based on tags from resolved/closed ChatSessions.
 */
export const getSupportTopChatIssues = async (limit = 5, period = 'daily') => {
    const { start, end } = getDateRange(period); // Use startTime or endTime for period filtering
    logger.info(`[Analytics Service Backend] Getting top chat issues for period: ${start.toISOString()} to ${end.toISOString()}`);
    const topIssues = await ChatSession.aggregate([
        {
            $match: {
                // Consider endTime or startTime for period, and only resolved/closed sessions
                status: { $in: [CHAT_SESSION_STATUS.RESOLVED, CHAT_SESSION_STATUS.CLOSED_BY_AGENT, CHAT_SESSION_STATUS.CLOSED_BY_USER] },
                endTime: { $gte: start, $lte: end }, // Or use createdAt if more appropriate for when issue was "logged"
                tags: { $exists: true, $ne: [] }
            }
        },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { _id: 0, tag: '$_id', count: 1 } }
    ]);
    return topIssues;
};

/**
 * Compiles all data for the Support Dashboard Overview based on ChatSession.
 */
export const getSupportDashboardLiveChatData = async (agentIdString, period = 'daily') => {
    logger.info(`[Analytics Service Backend] Compiling support live chat dashboard for agent ${agentIdString}, period ${period}.`);
    try {
        const agentObjectId = agentIdString ? new mongoose.Types.ObjectId(agentIdString) : null;
        const { start, end } = getDateRange(period);

        const openQueuedChats = await ChatSession.countDocuments({
            status: CHAT_SESSION_STATUS.QUEUED,
            supportAgentId: null // Explicitly unassigned
        });

        let myActiveChats = 0;
        if (agentObjectId) {
            myActiveChats = await ChatSession.countDocuments({
                status: CHAT_SESSION_STATUS.ACTIVE,
                supportAgentId: agentObjectId
            });
        }

        const totalChatsForPeriod = await ChatSession.countDocuments({
            startTime: { $gte: start, $lte: end } // Count chats initiated in period
        });

        const sessionsInPeriod = await ChatSession.find({
            // For avg times, consider sessions that were active or ended in the period
            $or: [
                { startTime: { $gte: start, $lte: end } }, // Started in period
                { endTime: { $gte: start, $lte: end } }    // Ended in period
            ],
            pickupTime: { $exists: true, $ne: null } // Must have been picked up
        }).select('startTime pickupTime endTime status').lean();

        let totalWaitTimeMs = 0;
        let pickedUpInPeriodCount = 0;
        let totalChatDurationMs = 0;
        let activeOrClosedInPeriodCount = 0;
        let resolvedInPeriodCount = 0;

        sessionsInPeriod.forEach(session => {
            const startTime = new Date(session.startTime).getTime();
            const pickupTime = new Date(session.pickupTime).getTime();

            // Average Wait Time: (for chats picked up in period)
            if (pickupTime >= start.getTime() && pickupTime <= end.getTime()) {
                totalWaitTimeMs += (pickupTime - startTime);
                pickedUpInPeriodCount++;
            }

            // Average Chat Duration: (for chats that had activity/ended in period)
            if (session.endTime) {
                const endTime = new Date(session.endTime).getTime();
                if (endTime >= start.getTime() && endTime <= end.getTime()) { // Ended in period
                    totalChatDurationMs += (endTime - pickupTime);
                    activeOrClosedInPeriodCount++;
                    if (session.status === CHAT_SESSION_STATUS.RESOLVED) {
                        resolvedInPeriodCount++;
                    }
                }
            } else if (session.status === CHAT_SESSION_STATUS.ACTIVE) {
                // For currently active chats started within period, count their duration so far
                if (pickupTime <= end.getTime() && startTime < end.getTime()) {
                    const durationSoFar = end.getTime() - pickupTime; // Duration until 'now' (end of period)
                    totalChatDurationMs += durationSoFar;
                    activeOrClosedInPeriodCount++;
                }
            }
        });

        const averageWaitTimeMinutes = pickedUpInPeriodCount > 0 ? parseFloat(((totalWaitTimeMs / pickedUpInPeriodCount) / (1000 * 60)).toFixed(2)) : 0;
        const averageChatDurationMinutes = activeOrClosedInPeriodCount > 0 ? parseFloat(((totalChatDurationMs / activeOrClosedInPeriodCount) / (1000 * 60)).toFixed(2)) : 0;

        const resolutionRate = (activeOrClosedInPeriodCount > 0 && resolvedInPeriodCount > 0) ? parseFloat(((resolvedInPeriodCount / activeOrClosedInPeriodCount) * 100).toFixed(2)) : 0;


        const chatTrendDays = period === 'weekly' ? 7 : (period === 'monthly' ? 30 : 7); // Default to 7 for daily view
        const chatTrend = await getDailyChatSessionTrend(chatTrendDays);
        const topIssues = await getSupportTopChatIssues(5, period);

        return {
            openQueuedChats,
            myActiveChats,
            totalChatsForPeriod,
            averageWaitTimeMinutes,
            averageChatDurationMinutes,
            resolvedTicketsForPeriod: resolvedInPeriodCount, // Number of tickets resolved in period
            resolutionRate, // Percentage
            chatTrend,
            topUserIssues: topIssues,
            period: period
        };

    } catch (error) {
        logger.error("[Analytics Service Backend] CRITICAL ERROR compiling support live chat dashboard data:", error);
        throw error;
    }
};

// Helper getStartOfDayUTC (ensure it's available or defined in this file)
// function getStartOfDayUTC(date) {
//     const d = new Date(date);
//     d.setUTCHours(0, 0, 0, 0);
//     return d;
// }