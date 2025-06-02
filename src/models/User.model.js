// src/models/User.model.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'; // For generating OTPs or reset tokens
import config from '../config/index.js';
import {
    ACCOUNT_STATUS,
    USER_ROLES,
    KYC_STATUS,
    SUPPORTED_CRYPTO_SYMBOLS,
    OTP_PURPOSES,
} from '../constants/index.js';

const payoutWalletSchema = new mongoose.Schema({
    cryptoSymbol: {
        type: String,
        enum: SUPPORTED_CRYPTO_SYMBOLS,
        required: true,
    },
    address: {
        type: String,
        trim: true,
        required: true,
    },
    isVerified: { // Optional: if you want to verify new wallet addresses via OTP
        type: Boolean,
        default: false,
    },
    addedAt: {
        type: Date,
        default: Date.now,
    },
}, { _id: false });


const kycDetailsSchema = new mongoose.Schema({
    documentType: { type: String, enum: ['Passport', 'NationalID', 'DriversLicense'] },
    documentNumber: { type: String, trim: true },
    documentFrontImage: { type: String }, // URL to the image
    documentBackImage: { type: String }, // URL to the image (if applicable)
    selfieImage: { type: String }, // URL to the image
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin user
    rejectionReason: { type: String },
}, { _id: false });


const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true,
            minlength: [3, "Full name must be at least 3 characters long"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/\S+@\S+\.\S+/, "Please use a valid email address"],
        },
        phoneNumber: {
            type: String,
            trim: true,
            // Add validation if needed, e.g., using a library like libphonenumber-js
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters long"],
            select: false, // Don't send password by default when querying users
        },
        country: {
            type: String,
            // Consider a predefined list or validation
        },
        preferredPayoutCrypto: {
            type: String,
            enum: [...SUPPORTED_CRYPTO_SYMBOLS, null], // Allow null if not set
            default: null,
        },
        role: {
            type: String,
            enum: Object.values(USER_ROLES),
            default: USER_ROLES.INVESTOR,
        },
        walletPin: {
            type: String, // 4 or 6 digit numeric PIN, bcrypt-hashed
            select: false, // Don't send PIN by default
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        emailVerificationToken: { type: String, select: false },
        emailVerificationTokenExpires: { type: Date, select: false },

        passwordResetToken: { type: String, select: false },
        passwordResetTokenExpires: { type: Date, select: false },

        pinChangeToken: { type: String, select: false }, // For OTP based PIN changes
        pinChangeTokenExpires: { type: Date, select: false },

        payoutWalletAddresses: { // Stores multiple payout addresses, one per crypto
            type: Map,
            of: String, // e.g. { "BTC": "btc_address", "ETH": "eth_address" }
            default: {},
        },

        // KYC Information
        kycStatus: {
            type: String,
            enum: Object.values(KYC_STATUS),
            default: KYC_STATUS.NOT_SUBMITTED,
        },
        kycDetails: kycDetailsSchema,

        // Account Status
        status: {
            type: String,
            enum: Object.values(ACCOUNT_STATUS),
            default: ACCOUNT_STATUS.PENDING_VERIFICATION, // Initially pending email verification
            index: true,
        },

        // Security & Tracking
        lastLoginAt: { type: Date },
        lastLoginIp: { type: String },
        registrationIp: { type: String },

        // 2FA (Two-Factor Authentication)
        twoFactorEnabled: {
            type: Boolean,
            default: false,
        },
        twoFactorSecret: { // For authenticator apps (e.g., Google Authenticator, Authy)
            type: String,
            select: false,
        },
        // Temporary 2FA secret during setup, if needed
        // twoFactorSetupSecret: { type: String, select: false },
        // twoFactorSetupExpires: { type: Date, select: false },

        // For refresh tokens if stored in DB (alternative to httpOnly cookie for refresh token itself)
        // refreshToken: { type: String, select: false },

        // Optional fields from blueprint
        // accountType: { type: String, default: "Investor" } // Covered by 'role'
        // dateOfRegistration is handled by timestamps: true
    },
    {
        timestamps: true, // Adds createdAt and updatedAt fields
    }
);

// --- Indexes ---
// userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ kycStatus: 1 });

// --- Pre-save middleware for hashing password and PIN ---
userSchema.pre('save', async function (next) {
    if (!this.isModified('password') && !this.isModified('walletPin')) return next();

    const saltRounds = 10;
    if (this.isModified('password') && this.password) {
        this.password = await bcrypt.hash(this.password, saltRounds);
    }
    if (this.isModified('walletPin') && this.walletPin) {
        // Ensure PIN is string before hashing if it's numeric input
        this.walletPin = await bcrypt.hash(String(this.walletPin), saltRounds);
    }
    next();
});

// --- Instance methods ---
userSchema.methods.isPasswordCorrect = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isWalletPinCorrect = async function (candidatePin) {
    if (!this.walletPin) return false;
    return bcrypt.compare(String(candidatePin), this.walletPin); // Ensure candidatePin is string
};

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            userId: this._id,
            email: this.email,
            role: this.role,
            // Add other relevant, non-sensitive info
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
    );
};

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            userId: this._id,
        },
        config.jwt.refreshSecret,
        { expiresIn: config.jwt.refreshExpiresIn }
    );
};

// Method to generate various tokens (OTP like)
userSchema.methods.generateVerificationToken = function (purpose) {
    const token = crypto.randomBytes(20).toString('hex'); // Or a 6-digit number
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    const expiryMinutes = config.otp.expiryMinutes || 10;

    switch (purpose) {
        case OTP_PURPOSES.EMAIL_VERIFICATION:
            this.emailVerificationToken = crypto.createHash('sha256').update(otp).digest('hex');
            this.emailVerificationTokenExpires = Date.now() + expiryMinutes * 60 * 1000;
            break;
        case OTP_PURPOSES.PASSWORD_RESET:
            this.passwordResetToken = crypto.createHash('sha256').update(otp).digest('hex');
            this.passwordResetTokenExpires = Date.now() + expiryMinutes * 60 * 1000;
            break;
        case OTP_PURPOSES.PIN_CHANGE:
            this.pinChangeToken = crypto.createHash('sha256').update(otp).digest('hex');
            this.pinChangeTokenExpires = Date.now() + expiryMinutes * 60 * 1000;
            break;
        // Add more cases for WALLET_ADDRESS_CHANGE, etc.
        default:
            throw new Error("Invalid token purpose specified");
    }
    return otp; // Return the plain OTP to be sent to the user
};

const User = mongoose.model('User', userSchema);
export default User;