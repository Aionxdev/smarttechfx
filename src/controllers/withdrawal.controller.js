// // src/controllers/withdrawal.controller.js
// import { withdrawalService, userService } from '../services/index.js';
// import { ApiResponse, sendSuccessResponse } from '../utils/apiResponse.util.js';
// import { HTTP_STATUS_CODES } from '../constants/index.js';
// import { pick } from '../utils/index.js';

// export const requestWithdrawalController = async (req, res) => {
//     const userId = req.user.userId;
//     const ipAddress = req.ip;
//     const { amountUSD, cryptocurrency, pin: userProvidedPin } = req.body;

//     const withdrawalRequest = await withdrawalService.requestWithdrawal(
//         userId,
//         parseFloat(amountUSD),
//         cryptocurrency,
//         userProvidedPin,
//         ipAddress
//     );

//     return sendSuccessResponse(
//         res,
//         HTTP_STATUS_CODES.CREATED,
//         pick(withdrawalRequest.toObject(), ['_id', 'amountUSD', 'cryptocurrency', 'status', 'requestDate']),
//         "Withdrawal request submitted successfully. It will be reviewed by an administrator."
//     );
// };

// export const getMyWithdrawals = async (req, res) => {
//     const userId = req.user.userId;
//     const queryParams = pick(req.query, ['page', 'limit', 'status', 'sortBy', 'sortOrder']);
//     const withdrawalsData = await withdrawalService.getUserWithdrawals(userId, queryParams);

//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, withdrawalsData, "User withdrawal history fetched successfully.");
// };

// export const getMyWithdrawalById = async (req, res) => {
//     const userId = req.user.userId;
//     const { withdrawalId } = req.params;
//     // A specific service method for user to get their own withdrawal by ID might be good for security
//     // For now, we can adapt the admin one or create a dedicated one.
//     // Let's assume a new service method for this:
//     // const withdrawal = await withdrawalService.getUserWithdrawalDetails(withdrawalId, userId);

//     // Simpler approach for now if adminGetAllWithdrawals also works and we filter by user
//     const withdrawal = await withdrawalService.adminGetAllWithdrawals({ _id: withdrawalId, user: userId, limit: 1 });
//     if (!withdrawal.withdrawals || withdrawal.withdrawals.length === 0) {
//         throw new NotFoundError("Withdrawal not found or you do not have access to it.");
//     }

//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, withdrawal.withdrawals[0], "Withdrawal details fetched successfully.");
// };

// // This is an example if users need to see their payout wallet addresses
// export const getMyPayoutWalletAddresses = async (req, res) => {
//     const userId = req.user.userId;
//     // The service currently doesn't have a dedicated function for this, 
//     // but user model has `payoutWalletAddresses`.
//     const user = await userService.findUserById(userId, 'payoutWalletAddresses');
//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, user.payoutWalletAddresses || {}, "Payout wallet addresses fetched.");
// };

// // Wallet Address Instructions: This would likely be static content or fetched from SupportedCrypto model.
// export const getWalletAddressInstructions = async (req, res) => {
//     // This is more about how to set up a wallet, not platform-specific addresses.
//     // For now, return a generic message. In a real app, this could be dynamic or link to FAQs.
//     const instructions = {
//         message: "To receive payouts, ensure you have a valid cryptocurrency wallet for the selected coin. You can set your payout addresses in your profile. Common wallet providers include Exodus, Trust Wallet, Ledger, or exchange wallets like Binance, Coinbase, etc. Always double-check your address before submitting a withdrawal request.",
//         supportedCoins: ["BTC", "ETH", "USDT", "SOL", "MATIC", "LTC", "XRP", "DOGE", "BNB", "BCH"] // From constants ideally
//     };
//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, instructions, "Wallet address instructions.");
// };

// // Transaction Status Tracking - This is essentially getMyWithdrawalById or getMyInvestments (for deposit status)
// // For a specific transaction, you might have a Transaction model and query it.
// // Assuming this refers to withdrawal status:
// export const getWithdrawalTransactionStatus = async (req, res) => {
//     const userId = req.user.userId;
//     const { withdrawalId } = req.params; // Assuming withdrawal ID is passed

//     // Same as getMyWithdrawalById essentially
//     const withdrawalData = await withdrawalService.adminGetAllWithdrawals({ _id: withdrawalId, user: userId, limit: 1 });
//     if (!withdrawalData.withdrawals || withdrawalData.withdrawals.length === 0) {
//         throw new NotFoundError("Withdrawal transaction not found or you do not have access to it.");
//     }
//     const withdrawal = withdrawalData.withdrawals[0];

//     const statusInfo = {
//         transactionId: withdrawal._id, // This is the platform's withdrawal ID
//         type: 'Withdrawal',
//         status: withdrawal.status,
//         amountUSD: withdrawal.amountUSD,
//         cryptocurrency: withdrawal.cryptocurrency,
//         amountCrypto: withdrawal.amountCrypto,
//         platformTxid: withdrawal.platformTransactionId, // Actual blockchain TXID, if processed
//         requestDate: withdrawal.requestDate,
//         lastUpdate: withdrawal.updatedAt,
//     };
//     return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, statusInfo, "Withdrawal transaction status fetched.");
// };

// src/controllers/withdrawal.controller.js
import { withdrawalService, userService } from '../services/index.js'; // Backend services
import { sendSuccessResponse } from '../utils/apiResponse.util.js';   // Backend util
import ApiError, { NotFoundError } from '../utils/apiError.util.js'; // Backend util
import { HTTP_STATUS_CODES, SUPPORTED_CRYPTO_SYMBOLS } from '../constants/index.js'; // Backend constants
import { pick } from '../utils/index.js'; // Backend util
import logger from '../utils/logger.util.js'; // Backend logger

export const requestWithdrawalController = async (req, res) => {
    // Ensure req.user and req.user._id are populated by verifyJWT
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User authentication not found.");
    }
    const userId = req.user._id.toString(); // Use _id and convert to string
    const ipAddress = req.ip;
    const { amountUSD, cryptocurrency, pin: userProvidedPin } = req.body;

    const withdrawalRequest = await withdrawalService.requestWithdrawal(
        userId,
        parseFloat(amountUSD),
        cryptocurrency,
        userProvidedPin,
        ipAddress
    );

    // Return a subset of fields from the created withdrawal request
    return sendSuccessResponse(
        res,
        HTTP_STATUS_CODES.CREATED,
        pick(withdrawalRequest.toObject({ virtuals: true }), ['_id', 'amountUSD', 'cryptocurrency', 'status', 'requestDate', 'userPayoutWalletAddress']),
        "Withdrawal request submitted successfully. It will be reviewed by an administrator."
    );
};

export const getMyWithdrawals = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User authentication not found.");
    }
    const userId = req.user._id.toString();
    const queryParams = pick(req.query, ['page', 'limit', 'status', 'sortBy', 'sortOrder']);

    // This service function should be specifically for fetching the current user's withdrawals
    const withdrawalsData = await withdrawalService.getUserWithdrawals(userId, queryParams);

    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, withdrawalsData, "User withdrawal history fetched successfully.");
};

export const getMyWithdrawalById = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User authentication not found.");
    }
    const userId = req.user._id.toString();
    const { withdrawalId } = req.params;

    // Dedicated service function to get a specific withdrawal for a specific user
    const withdrawal = await withdrawalService.getUserWithdrawalById(userId, withdrawalId);

    if (!withdrawal) { // Service should throw NotFoundError, but double-check
        throw new NotFoundError("Withdrawal not found or you do not have access to it.");
    }

    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, withdrawal, "Withdrawal details fetched successfully.");
};

export const getMyPayoutWalletAddresses = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User authentication not found.");
    }
    const userId = req.user._id.toString();

    // userService.findUserById should be robust enough
    const user = await userService.findUserById(userId, 'payoutWalletAddresses'); // Select only necessary fields

    if (!user) { // Should not happen if verifyJWT worked
        throw new NotFoundError("User not found.");
    }

    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, user.payoutWalletAddresses || {}, "Payout wallet addresses fetched.");
};

export const getWalletAddressInstructions = async (req, res) => {
    // This endpoint can remain public or require auth, depends on if instructions are generic
    // If it requires auth, add the userId check like others.
    // For now, keeping it as you had it (implicitly public within this controller if route isn't protected).
    const instructions = {
        message: "To receive payouts, ensure you have a valid cryptocurrency wallet for the selected coin. You can set your payout addresses in your profile using the 'My Profile' section. Common wallet providers include Exodus, Trust Wallet, Ledger, or exchange wallets like Binance, Coinbase, etc. Always double-check your address before submitting a withdrawal request. Ensure the network matches (e.g., ERC20 for Ethereum/USDT on Ethereum, TRC20 for USDT on Tron, BEP20 for BNB/BUSD on Binance Smart Chain).",
        supportedCoins: SUPPORTED_CRYPTO_SYMBOLS // Use constant from backend
    };
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, instructions, "Wallet address instructions fetched successfully.");
};


export const getWithdrawalTransactionStatus = async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(HTTP_STATUS_CODES.UNAUTHORIZED, "User authentication not found.");
    }
    const userId = req.user._id.toString();
    const { withdrawalId } = req.params;

    // Use the same dedicated service function as getMyWithdrawalByIdController
    const withdrawal = await withdrawalService.getUserWithdrawalById(userId, withdrawalId);

    if (!withdrawal) {
        throw new NotFoundError("Withdrawal transaction not found or you do not have access to it.");
    }

    // Format the response specifically for status tracking
    const statusInfo = {
        transactionId: withdrawal._id, // Platform's withdrawal ID
        type: 'Withdrawal', // Hardcoded as this endpoint is specific to withdrawals
        status: withdrawal.status,
        amountUSD: withdrawal.amountUSD,
        cryptocurrency: withdrawal.cryptocurrency,
        amountCrypto: withdrawal.amountCrypto, // Populated upon approval
        payoutAddress: withdrawal.userPayoutWalletAddress,
        platformTxid: withdrawal.platformTransactionId, // Blockchain TXID, populated upon processing
        requestDate: withdrawal.requestDate,
        approvalDate: withdrawal.approvalDate,
        completionDate: withdrawal.completionDate,
        rejectionReason: withdrawal.rejectionReason,
        lastUpdate: withdrawal.updatedAt,
    };
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, statusInfo, "Withdrawal transaction status fetched.");
};