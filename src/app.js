// src/app.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan'; // HTTP request logger
import helmet from 'helmet'; // For security headers
import rateLimit from 'express-rate-limit'; // Basic rate limiting

import config from './config/index.js';
import mainRouter from './routes/index.js';
import errorHandler from './middlewares/error.middleware.js';
import { NotFoundError } from './utils/apiError.util.js';

import 'express-async-errors';

const app = express();

// --- Security Middleware ---
app.use(helmet()); 

// --- CORS Configuration ---
app.use(cors(config.corsOptions));


// --- Rate Limiting ---
// Apply to all requests, or target specific API routes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // Limit each IP to 2000 requests per windowMs (adjust as needed)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes.' },
    // keyGenerator: (req) => req.ip, // Default, can customize
});
app.use(limiter); // Apply the rate limiting middleware to all requests


// --- Request Body & Cookie Parsing ---
app.use(express.json({ limit: '16kb' })); // Parse JSON bodies, limit size
app.use(express.urlencoded({ extended: true, limit: '16kb' })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies, needed for JWT in cookies & CSRF


// --- HTTP Request Logging ---
// Use 'combined' for production-like logs, 'dev' for development (colored, concise)
app.use(morgan(config.env === 'development' ? 'dev' : 'short'));


// --- Application Routes ---
app.use(mainRouter); // Mount all routes defined in src/routes/index.js


// --- Global Error Handling ---
app.use((req, res, next) => {
    // If the request path starts with /api and was not handled, it means it didn't match any API route
    if (req.path.startsWith('/api')) {
        return next(new NotFoundError("The requested API endpoint does not exist."));
    }
    // For non-API routes, you might serve a frontend or a different 404
    next(new NotFoundError("Resource not found."));
});

// Final Global Error Handler Middleware (catches all errors passed by next(err))
app.use(errorHandler);


export default app;