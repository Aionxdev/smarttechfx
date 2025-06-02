// src/constants/index.js

export const APP_NAME = 'SmartTechFX';

export const USER_ROLES = Object.freeze({
    INVESTOR: 'Investor',
    ADMIN: 'Admin',
    SUPPORT_AGENT: 'SupportAgent',
});

export const ACCOUNT_STATUS = Object.freeze({
    PENDING_VERIFICATION: 'PendingVerification', // For email verification
    ACTIVE: 'Active',
    SUSPENDED: 'Suspended',
    DEACTIVATED: 'Deactivated',
});

export const KYC_STATUS = Object.freeze({
    NOT_SUBMITTED: 'NotSubmitted',
    PENDING: 'Pending',
    VERIFIED: 'Verified',
    REJECTED: 'Rejected',
});

export const INVESTMENT_STATUS = Object.freeze({
    PENDING_VERIFICATION: 'PendingVerification', // Admin verifies TXID
    ACTIVE: 'Active', // Investment is ongoing
    MATURED: 'Matured', // Investment period completed
    WITHDRAWN: 'Withdrawn', // ROI + Capital (if applicable) paid out
    CANCELLED: 'Cancelled', // e.g., if TXID verification fails or user cancels before activation
});

export const WITHDRAWAL_STATUS = Object.freeze({
    PENDING: 'Pending', // User requested, admin approval pending
    APPROVED: 'Approved', // Admin approved, processing pending
    PROCESSING: 'Processing', // Payout is being executed
    COMPLETED: 'Completed', // Payout successful, TXID recorded
    REJECTED: 'Rejected', // Admin rejected the request
    CANCELLED: 'Cancelled', // User cancelled the request (if allowed)
});

export const TRANSACTION_TYPES = Object.freeze({
    DEPOSIT: 'Deposit',
    WITHDRAWAL: 'Withdrawal',
    ROI_PAYOUT: 'ROIPayout',
    REFERRAL_BONUS: 'ReferralBonus', // Example for future
    PLATFORM_FEE: 'PlatformFee',   // Example for future
});

export const TRANSACTION_STATUS = Object.freeze({
    PENDING: 'Pending',
    VERIFIED: 'Verified', // For deposits specifically
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
});

export const NOTIFICATION_TYPES = Object.freeze({
    SYSTEM: 'System', // General system announcements
    INVESTMENT_NEW: 'InvestmentNew',
    INVESTMENT_ACTIVATED: 'InvestmentActivated',
    INVESTMENT_MATURED: 'InvestmentMatured',
    INVESTMENT_ERROR: 'InvestmentError',
    WITHDRAWAL_REQUESTED: 'WithdrawalRequested',
    WITHDRAWAL_APPROVED: 'WithdrawalApproved',
    WITHDRAWAL_PROCESSED: 'WithdrawalProcessed',
    WITHDRAWAL_REJECTED: 'WithdrawalRejected',
    SECURITY_LOGIN: 'SecurityLogin',
    SECURITY_PASSWORD_CHANGE: 'SecurityPasswordChange',
    SECURITY_PIN_CHANGE: 'SecurityPinChange',
    SECURITY_WALLET_CHANGE: 'SecurityWalletChange',
    KYC_SUBMITTED: 'KycSubmitted',
    KYC_APPROVED: 'KycApproved',
    KYC_REJECTED: 'KycRejected',
    ANNOUNCEMENT: 'Announcement', // Admin broadcast
    AI_CHAT_ESCALATION: 'AIChatEscalation',
});

export const LOG_LEVELS = Object.freeze({
    INFO: 'Info',
    WARN: 'Warn',
    ERROR: 'Error',
    DEBUG: 'Debug',
    ADMIN_ACTION: 'AdminAction',
    USER_ACTION: 'UserAction',
    SYSTEM_EVENT: 'SystemEvent',
    USER_SUBMITTED_INVESTMENT_TXID: 'UserSubmittedInvestmentTxid',
});

export const LOG_EVENT_TYPES = Object.freeze({
    // User Actions
    USER_REGISTERED: 'UserRegistered',
    USER_LOGGED_IN: 'UserLoggedIn',
    USER_LOGGED_OUT: 'UserLoggedOut',
    USER_PROFILE_UPDATED: 'UserProfileUpdated',
    USER_PASSWORD_CHANGED: 'UserPasswordChanged',
    USER_PIN_SET: 'UserPinSet',
    USER_PIN_CHANGED: 'UserPinChanged',
    USER_PAYOUT_WALLET_SET: 'UserPayoutWalletSet',
    USER_PAYOUT_WALLET_CHANGED: 'UserPayoutWalletChanged',
    USER_KYC_SUBMITTED: 'UserKycSubmitted',
    // Investment Actions
    INVESTMENT_CREATED: 'InvestmentCreated', // User initiates
    INVESTMENT_TXID_VERIFIED: 'InvestmentTxidVerified', // Admin action
    INVESTMENT_ACTIVATED: 'InvestmentActivated',
    INVESTMENT_MATURED_SYSTEM: 'InvestmentMaturedSystem', // Auto system event
    INVESTMENT_REINVESTED: 'InvestmentReinvested',
    // Withdrawal Actions
    WITHDRAWAL_REQUESTED: 'WithdrawalRequested',
    WITHDRAWAL_APPROVED: 'WithdrawalApproved', // Admin action
    WITHDRAWAL_REJECTED: 'WithdrawalRejected', // Admin action
    WITHDRAWAL_PROCESSED: 'WithdrawalProcessed', // Admin/System action
    // OTP Actions
    OTP_GENERATED: 'OtpGenerated',
    OTP_VERIFIED: 'OtpVerified',
    OTP_FAILED: 'OtpFailed',
    // Admin Actions
    ADMIN_USER_BANNED: 'AdminUserBanned',
    ADMIN_USER_UNBANNED: 'AdminUserUnbanned',
    ADMIN_SETTINGS_UPDATED: 'AdminSettingsUpdated',
    ADMIN_BROADCAST_SENT: 'AdminBroadcastSent',
    // System Events
    SYSTEM_API_ERROR: 'SystemApiError',
    SYSTEM_EMAIL_SENT: 'SystemEmailSent',
    SYSTEM_EMAIL_FAILED: 'SystemEmailFailed',
    SYSTEM_CRON_JOB_EXECUTED: 'SystemCronJobExecuted',
    SYSTEM_PRICE_SYNC_ISSUE: 'SystemPriceSyncIssue',
    // AI Chat
    AI_CHAT_ESCALATED: 'AIChatEscalated',
    SUPPORT_CHAT_TAKEN_OVER: 'SupportChatTakenOver',

    SUPPORT_EMAIL_REPLY_SENT: 'SupportEmailReplySent',

    USER_INITIATED_CHAT: 'UserInitiatedChat',
    AGENT_ACCEPTED_CHAT: 'AgentAcceptedChat',
    LIVE_CHAT_MESSAGE_SENT: 'LiveChatMessageSent',
    CHAT_SESSION_CLOSED: 'ChatSessionClosed',
    CHAT_SESSION_RESOLVED: 'ChatSessionResolved',
});

export const SUPPORTED_CRYPTOCURRENCIES = Object.freeze([
    // This could also be managed in the DB via `SupportedCrypto` model
    // For now, having a constant list is fine for initial setup and validation
    { name: 'Bitcoin', symbol: 'BTC' },
    { name: 'Ethereum', symbol: 'ETH' },
    { name: 'Tether', symbol: 'USDT' },
    { name: 'Solana', symbol: 'SOL' },
    { name: 'Polygon', symbol: 'MATIC' },
    { name: 'Litecoin', symbol: 'LTC' },
    { name: 'Ripple', symbol: 'XRP' },
    { name: 'Dogecoin', symbol: 'DOGE' },
    { name: 'Binance Coin', symbol: 'BNB' },
    { name: 'Bitcoin Cash', symbol: 'BCH' },
]);

// Helper to get just symbols if needed
export const SUPPORTED_CRYPTO_SYMBOLS = Object.freeze(
    SUPPORTED_CRYPTOCURRENCIES.map(crypto => crypto.symbol)
);

export const OTP_PURPOSES = Object.freeze({
    EMAIL_VERIFICATION: 'EmailVerification',
    PASSWORD_RESET: 'PasswordReset',
    PIN_CHANGE: 'PinChange',
    WALLET_ADDRESS_SET: 'WalletAddressSet',
    WALLET_ADDRESS_CHANGE: 'WalletAddressChange',
    TWO_FACTOR_SETUP: 'TwoFactorSetup',
    TRANSACTION_CONFIRMATION: 'TransactionConfirmation', // e.g., high-value withdrawal
});

export const AI_CHAT_STORAGE_POLICY = Object.freeze({
    LOCAL_STORAGE_KEY_PREFIX: 'smarttechfx_ai_chat_',
    SESSION_DURATION_HOURS: 24, // Clear chat history after 24h of inactivity
});

export const CACHE_KEYS = Object.freeze({
    // Example cache keys if using Redis
    OTP_SESSION: (userId, purpose) => `otp:${userId}:${purpose}`,
    USER_SESSION: (userId) => `session:${userId}`,
    CRYPTO_PRICES: 'crypto_prices',
});

export const DEFAULT_PAGINATION_LIMIT = 10;
export const MAX_PAGINATION_LIMIT = 100;

// HTTP Status Codes (common ones)
export const HTTP_STATUS_CODES = Object.freeze({
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409, // e.g., resource already exists
    UNPROCESSABLE_ENTITY: 422, // Validation errors
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
});

// MAX_PAGINATION_LIMIT_CONSTANT
export const MAX_PAGINATION_LIMIT_CONSTANT = 100; // Maximum limit for pagination queries



export const CHAT_SESSION_STATUS = Object.freeze({
    QUEUED: 'Queued',           // User initiated, waiting for an agent
    ACTIVE: 'Active',           // Agent picked up, conversation ongoing
    CLOSED_BY_USER: 'ClosedByUser', // User closed the chat window or disconnected
    CLOSED_BY_AGENT: 'ClosedByAgent',// Agent closed the chat (might not be resolved)
    RESOLVED: 'Resolved',         // Agent marked the issue as resolved
    ABANDONED: 'Abandoned',       // User left queue before agent pickup
    TIMEOUT: 'Timeout',           // Session timed out due to inactivity
});

export const CHAT_MESSAGE_SENDER_TYPE = Object.freeze({
    USER: 'user',
    AGENT: 'agent',
    SYSTEM: 'system', // For automated messages like "Agent has joined", "Chat ended"
});


// Remove AI/Escalation related constants if they are no longer used:
// export const AI_CHAT_STORAGE_POLICY = Object.freeze({ ... });
// Some NOTIFICATION_TYPES might change if AI_CHAT_ESCALATION is removed

// Add more constants as needed for your application logic