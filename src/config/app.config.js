// src/config/app.config.js
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const config = {
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    appName: process.env.APP_NAME || 'SmartTechFX',
    clientURL: process.env.CLIENT_URL,

    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        cookieName: 'accessToken', // Name for the JWT cookie
        refreshCookieName: 'refreshToken', // Name for the refresh token cookie
    },

    apiKeys: {
        coinMarketCap: process.env.COINMARKETCAP_API_KEY,
    },

    email: {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT, 10) || 465,
        secure: process.env.EMAIL_SECURE === 'true', // Convert string 'true' to boolean
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        fromNoReply: process.env.EMAIL_FROM_NOREPLY,
    },

    otp: {
        expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10,
        maxAttempts: parseInt(process.env.MAX_OTP_ATTEMPTS, 10) || 5,
    },

    // Initial Admin User (optional, for seeding)
    initialAdmin: {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },

    corsOptions: {
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            // and requests from the clientURL
            if (!origin || origin === process.env.CLIENT_URL) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true, // Important for cookies
    },
};

// Basic validation for critical JWT secrets
if (!config.jwt.secret) {
    console.error("FATAL ERROR: JWT_SECRET is not defined. Server cannot start.");
    process.exit(1);
}
if (!config.jwt.refreshSecret) {
    console.error("FATAL ERROR: JWT_REFRESH_SECRET is not defined. Server cannot start.");
    process.exit(1); // You might choose to allow startup if refresh tokens are optional initially
}

export default config;