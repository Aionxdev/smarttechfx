// src/services/investment.service.js
import { Investment, InvestmentPlan, User, Transaction, SupportedCrypto } from '../models/index.js';
import ApiError, { NotFoundError, BadRequestError, ForbiddenError, UnprocessableEntityError } from '../utils/apiError.util.js';
import { HTTP_STATUS_CODES, INVESTMENT_STATUS, TRANSACTION_TYPES, TRANSACTION_STATUS, LOG_LEVELS, LOG_EVENT_TYPES } from '../constants/index.js';
import logger from '../utils/logger.util.js';
import { convertUSDToCrypto } from './crypto.service.js'; // For calculating crypto amount
import { sendInvestmentConfirmationEmail } from './email.service.js';
import { createLogEntry } from './log.service.js'; 
import { DEFAULT_PAGINATION_LIMIT, MAX_PAGINATION_LIMIT } from '../constants/index.js'; // For pagination limits
import mongoose from 'mongoose'; // For ObjectId conversion


export const initiateInvestment = async (userId, planId, investedAmountUSD, paymentCryptocurrencySymbol, userProvidedTxid = null, ipAddress) => {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError("User not found.");
    if (user.status !== 'Active') throw new ForbiddenError("Your account is not active. Please verify your email or contact support.");

    const plan = await InvestmentPlan.findById(planId);
    if (!plan || !plan.isActive) throw new NotFoundError("Investment plan not found or is not active.");

    if (investedAmountUSD < plan.investmentRange.minUSD || investedAmountUSD > plan.investmentRange.maxUSD) {
        throw new BadRequestError(`Investment amount $${investedAmountUSD} is outside the plan's range of $${plan.investmentRange.minUSD} - $${plan.investmentRange.maxUSD}.`);
    }

    const supportedCrypto = await SupportedCrypto.findOne({ symbol: paymentCryptocurrencySymbol.toUpperCase(), isActiveForInvestment: true });
    if (!supportedCrypto) {
        throw new BadRequestError(`Cryptocurrency ${paymentCryptocurrencySymbol} is not supported for investment or is inactive.`);
    }
    if (supportedCrypto.minInvestmentAmountCrypto && (investedAmountUSD / (await convertUSDToCrypto(investedAmountUSD, paymentCryptocurrencySymbol)).rate) < supportedCrypto.minInvestmentAmountCrypto) {
        // This check is a bit complex here, ideally convertUSDToCrypto is called once.
        // Simpler: Do this check after conversion.
    }


    const { cryptoAmount, rate } = await convertUSDToCrypto(investedAmountUSD, paymentCryptocurrencySymbol);

    // Check min crypto amount again with the calculated cryptoAmount if applicable
    if (supportedCrypto.minInvestmentAmountCrypto && cryptoAmount < supportedCrypto.minInvestmentAmountCrypto) {
        throw new BadRequestError(`The equivalent of $${investedAmountUSD} (${cryptoAmount} ${paymentCryptocurrencySymbol}) is below the minimum investment of ${supportedCrypto.minInvestmentAmountCrypto} ${paymentCryptocurrencySymbol} for this coin.`);
    }

    const investment = new Investment({
        user: userId,
        plan: planId,
        planNameSnapshot: plan.planName,
        dailyROIPercentageSnapshot: plan.dailyROIPercentage,
        durationDaysSnapshot: plan.durationDays,
        investedAmountUSD,
        paymentCryptocurrency: paymentCryptocurrencySymbol.toUpperCase(),
        paymentAmountCrypto: cryptoAmount, // This is the target amount. User needs to send this.
        cryptoToUSDRateSnapshot: rate,
        platformReceivingWalletAddress: supportedCrypto.platformDepositWalletAddress, // Address user needs to send to
        transactionId: userProvidedTxid, // Optional: user might provide it upfront
        status: INVESTMENT_STATUS.PENDING_VERIFICATION,
        // expectedDailyProfitUSD, expectedTotalProfitUSD, expectedTotalReturnUSD will be calculated by pre-save hook
    });
    await investment.save(); // This will trigger pre-save hooks for calculations

    // Create a pending deposit transaction
    await Transaction.create({
        user: userId,
        type: TRANSACTION_TYPES.DEPOSIT,
        relatedInvestment: investment._id,
        amountUSD: investedAmountUSD,
        cryptocurrency: paymentCryptocurrencySymbol.toUpperCase(),
        amountCrypto: cryptoAmount, // Expected amount
        cryptoToUSDRate: rate,
        platformWalletAddress: supportedCrypto.platformDepositWalletAddress,
        userTxid: userProvidedTxid,
        status: TRANSACTION_STATUS.PENDING,
        description: `Pending deposit for ${plan.planName} investment.`,
    });

    await createLogEntry(
        LOG_LEVELS.USER_ACTION,
        LOG_EVENT_TYPES.INVESTMENT_CREATED,
        `User ${user.email} initiated investment ID ${investment._id} for ${plan.planName} ($${investedAmountUSD} via ${cryptoAmount} ${paymentCryptocurrencySymbol}).`,
        userId,
        { planId, investmentId: investment._id, amountUSD: investedAmountUSD, crypto: paymentCryptocurrencySymbol },
        ipAddress
    );

    logger.info(`Investment ${investment._id} initiated by user ${userId} for plan ${planId}. Amount: $${investedAmountUSD} (${cryptoAmount} ${paymentCryptocurrencySymbol}).`);
    return {
        investmentId: investment._id,
        message: "Investment initiated. Please send the specified crypto amount to the provided address.",
        paymentDetails: {
            amount: cryptoAmount,
            currency: paymentCryptocurrencySymbol.toUpperCase(),
            address: supportedCrypto.platformDepositWalletAddress,
            usdEquivalent: investedAmountUSD,
            rate: rate,
            networkConfirmationsRequired: supportedCrypto.networkConfirmationThreshold || 'Not specified'
        }
    };
};

export const adminVerifyAndActivateInvestment = async (adminUserId, investmentId, actualCryptoAmountReceived, userTxid) => {
    const investment = await Investment.findById(investmentId).populate('user');
    if (!investment) throw new NotFoundError("Investment not found.");
    if (investment.status !== INVESTMENT_STATUS.PENDING_VERIFICATION) {
        throw new BadRequestError(`Investment is not pending verification. Current status: ${investment.status}`);
    }

    const plan = await InvestmentPlan.findById(investment.plan); // For logging/notifications
    if (!plan) throw new NotFoundError("Associated investment plan not found. Data integrity issue.");

    // Update the investment details
    investment.status = INVESTMENT_STATUS.ACTIVE;
    investment.activationDate = new Date();
    // The pre-save hook will calculate maturityDate based on activationDate and durationDaysSnapshot
    investment.paymentAmountCrypto = actualCryptoAmountReceived; // Update with actual received amount
    investment.transactionId = userTxid; // Confirmed TXID
    investment.verifiedBy = adminUserId;
    investment.verificationTimestamp = new Date();

    // Recalculate USD value if actual crypto received differs slightly and business rules allow
    // For simplicity, we assume investedAmountUSD from initiation is what's credited if TXID matches.
    // If actualCryptoAmountReceived significantly differs from expected, admin might reject or adjust.
    // For now, let's assume admin has verified the amount matches the initial `investedAmountUSD` closely enough.

    await investment.save(); // Triggers pre-save for maturityDate, profits calculation

    // Update the related deposit transaction
    const transaction = await Transaction.findOneAndUpdate(
        { relatedInvestment: investment._id, type: TRANSACTION_TYPES.DEPOSIT, status: TRANSACTION_STATUS.PENDING },
        {
            $set: {
                status: TRANSACTION_STATUS.VERIFIED, // Or COMPLETED if VERIFIED means admin verified TXID
                amountCrypto: actualCryptoAmountReceived, // Actual amount
                userTxid: userTxid,
                processedBy: adminUserId,
                completedAt: new Date(),
                description: `Deposit verified for ${investment.planNameSnapshot} investment.`
            }
        },
        { new: true }
    );

    if (!transaction) {
        logger.warn(`Could not find or update pending deposit transaction for investment ${investment._id}`);
        // This is an issue, may require manual correction or more robust transaction linking.
        // For now, proceed with investment activation but log this discrepancy.
    }

    await createLogEntry(
        LOG_LEVELS.ADMIN_ACTION,
        LOG_EVENT_TYPES.INVESTMENT_TXID_VERIFIED,
        `Admin ${adminUserId} verified and activated investment ID ${investment._id} for user ${investment.user.email}. Plan: ${investment.planNameSnapshot}.`,
        investment.user._id,
        { investmentId, userTxid, adminUserId, planName: investment.planNameSnapshot, actualCryptoAmountReceived },
        null, // IP not relevant for admin action server-side
        adminUserId
    );

    logger.info(`Investment ${investment._id} activated by admin ${adminUserId}.`);

    // Send confirmation email to user
    if (investment.user && investment.user.email) {
        await sendInvestmentConfirmationEmail(investment.user.email, {
            id: investment._id,
            planName: investment.planNameSnapshot,
            amountUSD: investment.investedAmountUSD,
            paymentAmountCrypto: investment.paymentAmountCrypto,
            paymentCryptocurrency: investment.paymentCryptocurrency,
            activationDate: investment.activationDate,
            maturityDate: investment.maturityDate,
            expectedTotalReturnUSD: investment.expectedTotalReturnUSD,
        });
    }

    return investment;
};

export const getUserInvestments = async (userId, queryParams = {}) => {
    const { page = 1, limit = DEFAULT_PAGINATION_LIMIT, status, sortBy = 'createdAt', sortOrder = 'desc' } = queryParams;
    const query = { user: userId };
    if (status && Object.values(INVESTMENT_STATUS).includes(status)) {
        query.status = status;
    }

    // Basic pagination
    const options = {
        sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
        skip: (Math.max(1, parseInt(page, 10)) - 1) * Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit, 10))),
        limit: Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit, 10))),
    };

    const investments = await Investment.find(query, null, options)
        .populate('plan', 'planName')
        .lean({ virtuals: true });
    // const investments = await Investment.find(query, null, options).populate('plan', 'planName').lean();
    const totalInvestments = await Investment.countDocuments(query);

    return {
        investments,
        totalPages: Math.ceil(totalInvestments / options.limit),
        currentPage: parseInt(page, 10),
        totalInvestments,
    };
};

// export const getUserInvestments = async (userId, queryParams = {}) => {
//     const { page = 1, limit = DEFAULT_PAGINATION_LIMIT, status, sortBy = 'createdAt', sortOrder = 'desc' } = queryParams;
//     const query = { user: userId };

//     if (status && Object.values(INVESTMENT_STATUS).includes(status)) {
//         query.status = status;
//     }

//     const options = {
//         sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
//         skip: (Math.max(1, parseInt(page, 10)) - 1) * Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit, 10))),
//         limit: Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit, 10))),
//     };

//     const investments = await Investment.find(query, null, options)
//         .populate('plan', 'planName')
//         .lean({ virtuals: true });

//     const totalInvestments = await Investment.countDocuments(query);

//     return {
//         investments,
//         totalPages: Math.ceil(totalInvestments / options.limit),
//         currentPage: parseInt(page, 10),
//         totalInvestments,
//     };
// };


// export const getInvestmentByIdForUser = async (investmentId, userId) => {
//     const investment = await Investment.findOne({ _id: investmentId, user: userId }).populate('plan', 'planName description').lean();
//     if (!investment) {
//         throw new NotFoundError("Investment not found or you do not have access to it.");
//     }
//     return investment;
// };

export const adminGetAllInvestments = async (queryParams = {}) => {
    const { page = 1, limit = DEFAULT_PAGINATION_LIMIT, status, userId, planId, sortBy = 'createdAt', sortOrder = 'desc' } = queryParams;
    const query = {};
    if (status && Object.values(INVESTMENT_STATUS).includes(status)) query.status = status;
    if (userId) query.user = userId;
    if (planId) query.plan = planId;

    const options = {
        sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
        skip: (Math.max(1, parseInt(page, 10)) - 1) * Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit, 10))),
        limit: Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit, 10))),
    };

    const investments = await Investment.find(query, null, options).populate('user', 'email fullName').populate('plan', 'planName').lean();
    const totalInvestments = await Investment.countDocuments(query);

    return {
        investments,
        totalPages: Math.ceil(totalInvestments / options.limit),
        currentPage: parseInt(page, 10),
        totalInvestments,
    };
};

export const adminGetInvestmentById = async (investmentId) => {
    const investment = await Investment.findById(investmentId).populate('user', 'email fullName').populate('plan', 'planName').lean();
    if (!investment) {
        throw new NotFoundError("Investment not found.");
    }
    return investment;
};


// Service for cron job to check for matured investments
export const processMaturedInvestments = async () => {
    const now = new Date();
    const maturedInvestments = await Investment.find({
        status: INVESTMENT_STATUS.ACTIVE,
        maturityDate: { $lte: now }
    }).populate('user plan');

    if (maturedInvestments.length === 0) {
        logger.info("Cron: No investments matured at this time.");
        return { processedCount: 0, errors: [] };
    }

    logger.info(`Cron: Found ${maturedInvestments.length} investments for maturity processing.`);
    let processedCount = 0;
    const errors = [];

    for (const investment of maturedInvestments) {
        try {
            investment.status = INVESTMENT_STATUS.MATURED;
            // TODO: Handle reinvestment logic if investment.isReinvestEnabled is true
            // This would involve creating a new investment.
            // For now, just mark as matured.
            await investment.save();
            processedCount++;

            // Create an ROI payout transaction (pending admin approval for withdrawal)
            await Transaction.create({
                user: investment.user._id,
                type: TRANSACTION_TYPES.ROI_PAYOUT,
                relatedInvestment: investment._id,
                amountUSD: investment.expectedTotalProfitUSD, // This is just the profit part
                // Or amountUSD: investment.expectedTotalReturnUSD if returning capital + profit
                cryptocurrency: investment.user.preferredPayoutCrypto || investment.paymentCryptocurrency, // Fallback
                // amountCrypto needs to be calculated at withdrawal time
                status: TRANSACTION_STATUS.PENDING, // Pending admin approval for payout
                description: `ROI matured for ${investment.planNameSnapshot}. Ready for withdrawal.`,
            });

            logger.info(`Cron: Investment ${investment._id} for user ${investment.user.email} marked as MATURED.`);

            // TODO: Send in-app and email notification to user about matured investment
            // (e.g., using a notificationService.createNotification function)
            // await notificationService.createNotification(investment.user._id, NOTIFICATION_TYPES.INVESTMENT_MATURED, ...);

            await createLogEntry(
                LOG_LEVELS.SYSTEM_EVENT,
                LOG_EVENT_TYPES.INVESTMENT_MATURED_SYSTEM,
                `Investment ID ${investment._id} for user ${investment.user.email} has matured. Plan: ${investment.planNameSnapshot}.`,
                investment.user._id,
                { investmentId: investment._id, planName: investment.planNameSnapshot }
            );

        } catch (error) {
            logger.error(`Cron: Error processing matured investment ${investment._id}:`, error);
            errors.push({ investmentId: investment._id, error: error.message });
        }
    }
    return { processedCount, errors };
};

// TODO: Admin function to cancel a PENDING_VERIFICATION investment if TXID is invalid/not received.
export const adminCancelPendingInvestment = async (adminUserId, investmentId, reason) => {
    const investment = await Investment.findById(investmentId).populate('user');
    if (!investment) throw new NotFoundError("Investment not found.");
    if (investment.status !== INVESTMENT_STATUS.PENDING_VERIFICATION) {
        throw new BadRequestError(`Investment is not pending verification. Current status: ${investment.status}`);
    }

    investment.status = INVESTMENT_STATUS.CANCELLED;
    investment.adminNotes = `Cancelled by admin ${adminUserId}. Reason: ${reason}`;
    // investment.verifiedBy = adminUserId; // Or a 'cancelledBy' field
    await investment.save();

    // Update or delete related pending transaction
    await Transaction.findOneAndUpdate(
        { relatedInvestment: investment._id, type: TRANSACTION_TYPES.DEPOSIT, status: TRANSACTION_STATUS.PENDING },
        { $set: { status: TRANSACTION_STATUS.CANCELLED, description: `Deposit cancelled for investment. Reason: ${reason}` } }
    );

    await createLogEntry(
        LOG_LEVELS.ADMIN_ACTION,
        LOG_EVENT_TYPES.INVESTMENT_CANCELLED, // Add this to constants
        `Admin ${adminUserId} cancelled pending investment ID ${investment._id}. Reason: ${reason}`,
        investment.user._id,
        { investmentId, reason, adminUserId },
        null,
        adminUserId
    );

    logger.info(`Pending investment ${investmentId} cancelled by admin ${adminUserId}. Reason: ${reason}`);
    // TODO: Notify user if necessary
    return investment;
};

export const userSubmitTxidForInvestment = async (userId, investmentId, userProvidedTxid) => {
    const investment = await Investment.findOne({ _id: investmentId, user: userId });

    if (!investment) {
        throw new NotFoundError("Investment not found or you do not have access to it.");
    }

    if (investment.status !== INVESTMENT_STATUS.PENDING_VERIFICATION) {
        throw new BadRequestError(`Cannot submit TXID. Investment status is currently: ${investment.status}. It must be 'PendingVerification'.`);
    }

    // Optional: Check if a TXID was already submitted to prevent accidental overwrites by user,
    // though admin verification is the final gate.
    if (investment.transactionId && investment.transactionId !== userProvidedTxid) {
        logger.warn(`User ${userId} is attempting to update an already submitted TXID for investment ${investmentId}. Old: ${investment.transactionId}, New: ${userProvidedTxid}`);
        // You might choose to allow this or throw an error/warning. For now, allow update.
    }

    investment.transactionId = userProvidedTxid;
    await investment.save();

    // Also update the 'userTxid' field in the associated PENDING deposit transaction
    const updatedTransaction = await Transaction.findOneAndUpdate(
        { relatedInvestment: investment._id, type: TRANSACTION_TYPES.DEPOSIT, status: TRANSACTION_STATUS.PENDING },
        { $set: { userTxid: userProvidedTxid } },
        { new: true } // Optional: return the updated document
    );

    if (updatedTransaction) {
        logger.info(`User-provided TXID ${userProvidedTxid} also updated on related transaction ${updatedTransaction._id} for investment ${investmentId}`);
    } else {
        logger.warn(`Could not find or update pending deposit transaction with userTxid for investment ${investmentId}. This might indicate a data consistency issue if a pending transaction was expected.`);
    }

    await createLogEntry(
        LOG_LEVELS.USER_ACTION,
        LOG_EVENT_TYPES.USER_SUBMITTED_INVESTMENT_TXID, // <<< Add this to constants/index.js LOG_EVENT_TYPES
        `User ${userId} submitted TXID ${userProvidedTxid} for investment ${investmentId}.`,
        userId,
        { investmentId, transactionId: userProvidedTxid }
    );

    logger.info(`User ${userId} submitted TXID ${userProvidedTxid} for investment ${investmentId}. Awaiting admin verification.`);

    // Notify admin that a TXID has been submitted for verification for this investment.
    
    // Or you could create a log entry for admin review
    await createLogEntry(
        LOG_LEVELS.SYSTEM_EVENT,
        LOG_EVENT_TYPES.INVESTMENT_TXID_SUBMITTED_FOR_VERIFICATION,
        `Investment ID ${investmentId} TXID ${userProvidedTxid} submitted by user ${userId} for admin verification.`,
        null, // No specific user for this log entry
        { investmentId, userProvidedTxid }
    );

    return {
        message: "Transaction ID submitted successfully. It will be reviewed by our team shortly.",
        investmentId: investment._id,
        submittedTxid: investment.transactionId
    };
};

export const getInvestmentByIdForUser = async (investmentId, userId) => {
    // const investment = await Investment.findOne({ _id: investmentId, user: userId }).populate('plan', 'planName description').lean(); // Original

    // DEBUGGING:
    logger.info(`[Investment Service] getInvestmentByIdForUser called. investmentId: ${investmentId}, userId: ${userId}`);
    const investment = await Investment.findOne({
        _id: new mongoose.Types.ObjectId(investmentId), // Ensure investmentId is an ObjectId
        user: new mongoose.Types.ObjectId(userId)      // Ensure userId is an ObjectId
    }).populate('plan', 'planName description').lean();
    logger.info(`[Investment Service] Found investment by ID for user: ${investment ? investment._id : 'null'}`);

    if (!investment) { // This condition is being met
        throw new NotFoundError("Investment not found or you do not have access to it.");
    }
    return investment;
};


export const getInvestmentProgressDetails = async (investmentId, userId) => {
    const investment = await Investment.findOne({
        _id: new mongoose.Types.ObjectId(investmentId),
        user: new mongoose.Types.ObjectId(userId)
    }).lean();

    if (!investment) {
        throw new NotFoundError("Investment not found or access denied.");
    }

    let progressPercent = 0;
    let daysRemaining = 0;
    let currentAccrued = investment.currentProfitUSD || 0; // Use stored if available

    if (investment.status === INVESTMENT_STATUS.ACTIVE && investment.activationDate && investment.maturityDate) {
        const activationDate = new Date(investment.activationDate);
        const maturityDate = new Date(investment.maturityDate);
        const today = new Date();

        const totalDurationMs = maturityDate.getTime() - activationDate.getTime();
        let elapsedMs = today.getTime() - activationDate.getTime();
        elapsedMs = Math.max(0, elapsedMs); // Cannot be negative

        progressPercent = totalDurationMs > 0 ? Math.min(100, (elapsedMs / totalDurationMs) * 100) : 0;

        const remainingMs = Math.max(0, maturityDate.getTime() - today.getTime());
        daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

        // Recalculate current profit if not reliably stored/updated by cron
        if (currentAccrued === 0 && typeof investment.dailyROIPercentageSnapshot === 'number' && typeof investment.investedAmountUSD === 'number') {
            let daysActive = Math.floor(elapsedMs / (1000 * 60 * 60 * 24)) + 1; // +1 because first day counts
            daysActive = Math.min(daysActive, investment.durationDaysSnapshot);
            daysActive = Math.max(0, daysActive);
            const dailyProfit = (investment.investedAmountUSD * investment.dailyROIPercentageSnapshot) / 100;
            currentAccrued = parseFloat((dailyProfit * daysActive).toFixed(2));
        }

    } else if (investment.status === INVESTMENT_STATUS.MATURED || investment.status === INVESTMENT_STATUS.WITHDRAWN) {
        progressPercent = 100;
        currentAccrued = investment.expectedTotalProfitUSD || 0;
    }

    return {
        investmentId: investment._id,
        planNameSnapshot: investment.planNameSnapshot,
        status: investment.status,
        progressPercent: parseFloat(progressPercent.toFixed(2)),
        currentAccruedProfitUSD: currentAccrued,
        expectedTotalProfitUSD: investment.expectedTotalProfitUSD,
        investedAmountUSD: investment.investedAmountUSD,
        activationDate: investment.activationDate,
        maturityDate: investment.maturityDate,
        daysRemaining: daysRemaining,
    };
};
