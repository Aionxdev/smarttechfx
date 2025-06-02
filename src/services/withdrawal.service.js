// src/services/withdrawal.service.js
import { Withdrawal, User, Investment, Transaction, SupportedCrypto } from '../models/index.js';
import ApiError, { NotFoundError, BadRequestError, ForbiddenError, UnprocessableEntityError } from '../utils/apiError.util.js';
import { HTTP_STATUS_CODES, WITHDRAWAL_STATUS, TRANSACTION_TYPES, TRANSACTION_STATUS, ACCOUNT_STATUS, INVESTMENT_STATUS, LOG_LEVELS, LOG_EVENT_TYPES, USER_ROLES } from '../constants/index.js';
import logger from '../utils/logger.util.js';
import { convertUSDToCrypto } from './crypto.service.js';
// import { sendWithdrawalRequestedEmail, sendWithdrawalProcessedEmail, sendWithdrawalRejectedEmail } from './email.service.js'; // Assuming these exist
import { createLogEntry } from './log.service.js'; // Assuming a dedicated log service
import mongoose from 'mongoose'; // For transactions if needed
import { DEFAULT_PAGINATION_LIMIT, MAX_PAGINATION_LIMIT } from '../constants/index.js'; // Assuming these are defined in your config


export const requestWithdrawal = async (userId, amountUSD, payoutCryptocurrencySymbol, userProvidedPin, ipAddress) => {
    const user = await User.findById(userId).select('+walletPin +payoutWalletAddresses'); // Need PIN and wallet addresses
    if (!user) throw new NotFoundError("User not found.");
    if (user.status !== ACCOUNT_STATUS.ACTIVE) throw new ForbiddenError("Your account is not active or is suspended.");
    if (!user.isEmailVerified) throw new ForbiddenError("Please verify your email before requesting a withdrawal.");
    // TODO: Add KYC check if withdrawals require KYC: if (user.kycStatus !== KYC_STATUS.VERIFIED) throw new ForbiddenError("KYC verification required for withdrawals.");

    if (!user.walletPin) throw new BadRequestError("Wallet PIN not set. Please set your PIN before requesting a withdrawal.");
    const isPinCorrect = await user.isWalletPinCorrect(userProvidedPin);
    if (!isPinCorrect) throw new BadRequestError("Incorrect wallet PIN.");

    const payoutAddress = user.payoutWalletAddresses.get(payoutCryptocurrencySymbol.toUpperCase());
    if (!payoutAddress) {
        throw new BadRequestError(`Payout wallet address for ${payoutCryptocurrencySymbol} is not set in your profile. Please, set it first`);
    }

    const supportedCrypto = await SupportedCrypto.findOne({ symbol: payoutCryptocurrencySymbol.toUpperCase(), isActiveForPayout: true });
    if (!supportedCrypto) {
        throw new BadRequestError(`Withdrawals in ${payoutCryptocurrencySymbol} are currently not supported or the currency is inactive.`);
    }

    // --- Calculate available balance for withdrawal ---
    // This is a crucial part. "Available balance" can come from:
    // 1. Sum of `expectedTotalProfitUSD` from `MATURED` investments that haven't been withdrawn yet.
    // 2. Or, if you allow withdrawing principal + profit, then `expectedTotalReturnUSD`.
    // 3. Or a separate 'available_balance_usd' field on the User model updated by cron jobs/transactions.
    // For simplicity, let's assume we're withdrawing profits from matured investments.

    const maturedUnwithdrawnInvestments = await Investment.find({
        user: userId,
        status: INVESTMENT_STATUS.MATURED, // Only matured investments that haven't been fully withdrawn
    });

    let availableToWithdrawUSD = 0;
    const associatedInvestmentIds = [];

    for (const inv of maturedUnwithdrawnInvestments) {
        // Check if an ROI_PAYOUT transaction for this investment is already completed or pending approval for the full amount
        const existingPayouts = await Transaction.find({
            relatedInvestment: inv._id,
            type: TRANSACTION_TYPES.ROI_PAYOUT,
            status: { $in: [TRANSACTION_STATUS.PENDING, TRANSACTION_STATUS.VERIFIED, TRANSACTION_STATUS.COMPLETED] }
        });

        let alreadyPaidOrPendingUSD = 0;
        existingPayouts.forEach(p => { alreadyPaidOrPendingUSD += p.amountUSD; });

        const remainingProfitForThisInvestment = Math.max(0, inv.expectedTotalProfitUSD - alreadyPaidOrPendingUSD);
        availableToWithdrawUSD += remainingProfitForThisInvestment;
        if (remainingProfitForThisInvestment > 0) {
            associatedInvestmentIds.push(inv._id); // Keep track of which investments contribute to this withdrawal
        }
    }

    availableToWithdrawUSD = parseFloat(availableToWithdrawUSD.toFixed(2));

    if (amountUSD <= 0) throw new BadRequestError("Withdrawal amount must be positive.");
    if (amountUSD > availableToWithdrawUSD) {
        throw new BadRequestError(`Insufficient available balance. You can withdraw up to $${availableToWithdrawUSD.toFixed(2)}.`);
    }

    // TODO: Check against min/max withdrawal limits defined globally or per currency
    if (supportedCrypto.minWithdrawalAmountCrypto) {
        const { cryptoAmount: minCryptoEquiv } = await convertUSDToCrypto(0.01, payoutCryptocurrencySymbol); // Get rate
        const minUsdEquivForMinCrypto = supportedCrypto.minWithdrawalAmountCrypto * (0.01 / minCryptoEquiv.cryptoAmount); // approx
        if (amountUSD < minUsdEquivForMinCrypto) {
            // This conversion is tricky, better to convert requested amountUSD to crypto and check
        }
    }

    // Create the withdrawal request
    const withdrawal = new Withdrawal({
        user: userId,
        // investment: Can be multiple, so maybe an array `relatedInvestments` or handle via transactions
        amountUSD,
        cryptocurrency: payoutCryptocurrencySymbol.toUpperCase(),
        userPayoutWalletAddress: payoutAddress,
        status: WITHDRAWAL_STATUS.PENDING,
    });
    await withdrawal.save();

    // Create a PENDING withdrawal transaction. The actual crypto amount will be set upon approval.
    await Transaction.create({
        user: userId,
        type: TRANSACTION_TYPES.WITHDRAWAL,
        relatedWithdrawal: withdrawal._id,
        // relatedInvestments: associatedInvestmentIds, // If tracking which investments are being paid out
        amountUSD,
        cryptocurrency: payoutCryptocurrencySymbol.toUpperCase(),
        // amountCrypto and rate to be filled on approval by admin
        userWalletAddress: payoutAddress,
        status: TRANSACTION_STATUS.PENDING,
        description: `Withdrawal request for $${amountUSD} via ${payoutCryptocurrencySymbol}.`,
    });

    await createLogEntry(
        LOG_LEVELS.USER_ACTION,
        LOG_EVENT_TYPES.WITHDRAWAL_REQUESTED,
        `User ${user.email} requested withdrawal ID ${withdrawal._id} for $${amountUSD} via ${payoutCryptocurrencySymbol}.`,
        userId,
        { withdrawalId: withdrawal._id, amountUSD, crypto: payoutCryptocurrencySymbol },
        ipAddress
    );

    logger.info(`Withdrawal request ${withdrawal._id} created for user ${userId}. Amount: $${amountUSD} via ${payoutCryptocurrencySymbol}.`);
    // TODO: Send email to user: sendWithdrawalRequestedEmail(user.email, withdrawalDetails);
    // TODO: Notify admin about new withdrawal request

    return withdrawal;
};

export const adminApproveWithdrawal = async (adminUserId, withdrawalId, platformTxid) => {
    const session = await mongoose.startSession(); // Use a transaction for atomicity
    session.startTransaction();
    try {
        const withdrawal = await Withdrawal.findById(withdrawalId).populate('user', 'email');
        if (!withdrawal) throw new NotFoundError("Withdrawal request not found.");
        if (withdrawal.status !== WITHDRAWAL_STATUS.PENDING) {
            throw new BadRequestError(`Withdrawal is not pending approval. Current status: ${withdrawal.status}`);
        }

        const { cryptoAmount, rate } = await convertUSDToCrypto(withdrawal.amountUSD, withdrawal.cryptocurrency);

        // Update withdrawal record
        withdrawal.status = WITHDRAWAL_STATUS.APPROVED; // Or directly to PROCESSING/COMPLETED if TXID means it's sent
        withdrawal.amountCrypto = cryptoAmount;
        withdrawal.cryptoToUSDRateSnapshot = rate;
        withdrawal.approvedBy = adminUserId;
        withdrawal.approvalDate = new Date();
        withdrawal.platformTransactionId = platformTxid; // Assuming admin provides TXID when approving (meaning it's sent)
        withdrawal.processingDate = new Date(); // If TXID implies processing
        withdrawal.completionDate = new Date(); // If TXID implies completion
        // For a more granular flow, status could be: PENDING -> APPROVED -> PROCESSING (admin sends) -> COMPLETED (network confirmed)

        await withdrawal.save({ session });

        // Update the related transaction
        const updatedTransaction = await Transaction.findOneAndUpdate(
            { relatedWithdrawal: withdrawal._id, type: TRANSACTION_TYPES.WITHDRAWAL, status: TRANSACTION_STATUS.PENDING },
            {
                $set: {
                    status: TRANSACTION_STATUS.COMPLETED, // Assuming TXID means it's done
                    amountCrypto: cryptoAmount,
                    cryptoToUSDRate: rate,
                    platformTxid: platformTxid,
                    processedBy: adminUserId,
                    completedAt: new Date(),
                    description: `Withdrawal of $${withdrawal.amountUSD} (${cryptoAmount} ${withdrawal.cryptocurrency}) approved and processed.`
                }
            },
            { new: true, session }
        );

        if (!updatedTransaction) {
            throw new Error(`Failed to update corresponding transaction for withdrawal ${withdrawal._id}.`);
        }

        // Mark associated ROI_PAYOUT transactions as completed (if this withdrawal covers them)
        // This part is complex: needs to map the withdrawal amount back to specific ROI payouts.
        // For simplicity now, we assume admin handles this logic or the initial "available balance" check was sufficient.
        // A more robust system would link this withdrawal to specific matured investment payouts.

        await session.commitTransaction();

        await createLogEntry(
            LOG_LEVELS.ADMIN_ACTION,
            LOG_EVENT_TYPES.WITHDRAWAL_APPROVED, // Or WITHDRAWAL_PROCESSED
            `Admin ${adminUserId} approved and processed withdrawal ID ${withdrawal._id} for user ${withdrawal.user.email}. TXID: ${platformTxid}.`,
            withdrawal.user._id,
            { withdrawalId, adminUserId, platformTxid, amountUSD: withdrawal.amountUSD, crypto: withdrawal.cryptocurrency },
            null, adminUserId
        );
        logger.info(`Withdrawal ${withdrawal._id} approved and processed by admin ${adminUserId}. TXID: ${platformTxid}`);
        // TODO: Send email to user: sendWithdrawalProcessedEmail(withdrawal.user.email, withdrawalDetails);

        return withdrawal;

    } catch (error) {
        await session.abortTransaction();
        logger.error(`Error in adminApproveWithdrawal for ID ${withdrawalId}:`, error);
        if (error instanceof ApiError) throw error;
        throw new ApiError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, "Failed to approve withdrawal.");
    } finally {
        session.endSession();
    }
};

export const adminRejectWithdrawal = async (adminUserId, withdrawalId, rejectionReason) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const withdrawal = await Withdrawal.findById(withdrawalId).populate('user', 'email');
        if (!withdrawal) throw new NotFoundError("Withdrawal request not found.");
        if (withdrawal.status !== WITHDRAWAL_STATUS.PENDING) {
            throw new BadRequestError(`Withdrawal is not pending approval. Current status: ${withdrawal.status}`);
        }

        withdrawal.status = WITHDRAWAL_STATUS.REJECTED;
        withdrawal.rejectionReason = rejectionReason;
        withdrawal.approvedBy = adminUserId; // Admin who actioned it
        withdrawal.approvalDate = new Date(); // Timestamp of action
        await withdrawal.save({ session });

        // Update the related transaction
        const updatedTransaction = await Transaction.findOneAndUpdate(
            { relatedWithdrawal: withdrawal._id, type: TRANSACTION_TYPES.WITHDRAWAL, status: TRANSACTION_STATUS.PENDING },
            {
                $set: {
                    status: TRANSACTION_STATUS.REJECTED,
                    processedBy: adminUserId,
                    completedAt: new Date(), // Rejection is a form of completion of this request
                    description: `Withdrawal request rejected. Reason: ${rejectionReason}`
                }
            },
            { new: true, session }
        );

        if (!updatedTransaction) {
            throw new Error(`Failed to update corresponding transaction for rejected withdrawal ${withdrawal._id}.`);
        }

        // If withdrawal was rejected, the funds are effectively "returned" to available balance.
        // No specific action needed here as the funds were never "deducted" from available balance until approval.

        await session.commitTransaction();

        await createLogEntry(
            LOG_LEVELS.ADMIN_ACTION,
            LOG_EVENT_TYPES.WITHDRAWAL_REJECTED,
            `Admin ${adminUserId} rejected withdrawal ID ${withdrawal._id} for user ${withdrawal.user.email}. Reason: ${rejectionReason}.`,
            withdrawal.user._id,
            { withdrawalId, adminUserId, rejectionReason },
            null, adminUserId
        );
        logger.info(`Withdrawal ${withdrawal._id} rejected by admin ${adminUserId}. Reason: ${rejectionReason}`);
        // TODO: Send email to user: sendWithdrawalRejectedEmail(withdrawal.user.email, withdrawalDetails, rejectionReason);

        return withdrawal;
    } catch (error) {
        await session.abortTransaction();
        logger.error(`Error in adminRejectWithdrawal for ID ${withdrawalId}:`, error);
        if (error instanceof ApiError) throw error;
        throw new ApiError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, "Failed to reject withdrawal.");
    } finally {
        session.endSession();
    }
};

export const getUserWithdrawals = async (userId, queryParams = {}) => {
    const { page = 1, limit = DEFAULT_PAGINATION_LIMIT, status, sortBy = 'requestDate', sortOrder = 'desc' } = queryParams;
    const query = { user: userId };
    if (status && Object.values(WITHDRAWAL_STATUS).includes(status)) {
        query.status = status;
    }

    const options = {
        sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
        skip: (Math.max(1, parseInt(page, 10)) - 1) * Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit, 10))),
        limit: Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit, 10))),
    };

    const withdrawals = await Withdrawal.find(query, null, options).lean();
    const totalWithdrawals = await Withdrawal.countDocuments(query);

    return {
        withdrawals,
        totalPages: Math.ceil(totalWithdrawals / options.limit),
        currentPage: parseInt(page, 10),
        totalWithdrawals,
    };
};

export const getUserWithdrawalById = async (userId, withdrawalId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const withdrawalObjectId = new mongoose.Types.ObjectId(withdrawalId);

    const withdrawal = await Withdrawal.findOne({
        _id: withdrawalObjectId,
        user: userObjectId  // Ensures the user owns this withdrawal request
    }).lean(); // .lean() is fine for read-only

    // No need to throw NotFoundError here, controller can do it if null is returned.
    // Or, service can throw:
    // if (!withdrawal) {
    //     throw new NotFoundError("Withdrawal request not found or access denied.");
    // }
    return withdrawal;
};

export const adminGetAllWithdrawals = async (queryParams = {}) => {
    const { page = 1, limit = DEFAULT_PAGINATION_LIMIT, status, userId, sortBy = 'requestDate', sortOrder = 'desc' } = queryParams;
    const query = {};
    if (status && Object.values(WITHDRAWAL_STATUS).includes(status)) query.status = status;
    if (userId) query.user = userId;

    const options = {
        sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
        skip: (Math.max(1, parseInt(page, 10)) - 1) * Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit, 10))),
        limit: Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit, 10))),
    };

    const withdrawals = await Withdrawal.find(query, null, options).populate('user', 'email fullName').lean();
    const totalWithdrawals = await Withdrawal.countDocuments(query);

    return {
        withdrawals,
        totalPages: Math.ceil(totalWithdrawals / options.limit),
        currentPage: parseInt(page, 10),
        totalWithdrawals,
    };
};