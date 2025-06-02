// src/routes/index.js
import express from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import investmentRoutes from './investment.routes.js';
import withdrawalRoutes from './withdrawal.routes.js';
import planRoutes from './plan.routes.js'; // For users to view plans
import adminRoutes from './admin/index.js'; // Main admin router
import publicApiRoutes from './public.routes.js'; // For public data like crypto tickers
import analyticsRoutes from './analytics.routes.js'; // Analytics routes


const router = express.Router();

const V1_API_PREFIX = '/api/v1';

// Publicly accessible routes (e.g., crypto prices, basic plan info)
router.use(`${V1_API_PREFIX}/public`, publicApiRoutes);

// Authentication routes
router.use(`${V1_API_PREFIX}/auth`, authRoutes);

// User-specific routes (authenticated users)
router.use(`${V1_API_PREFIX}/users`, userRoutes);

// Investment routes (authenticated users)
router.use(`${V1_API_PREFIX}/investments`, investmentRoutes);

// Withdrawal routes (authenticated users)
router.use(`${V1_API_PREFIX}/withdrawals`, withdrawalRoutes);


// Plan viewing routes (for users, typically GET requests)
router.use(`${V1_API_PREFIX}/plans`, planRoutes);


// --- Analytics Routes ---
router.use(`${V1_API_PREFIX}/analytics`, analyticsRoutes);


// --- Admin Routes ---
// All routes under /admin will be further protected by admin role check
router.use(`${V1_API_PREFIX}/admin`, adminRoutes);


// Simple health check route
router.get(`${V1_API_PREFIX}/health`, (req, res) => {
    res.status(200).json({ status: 'UP', message: 'SmartTechFX API is healthy!' });
});


export default router;