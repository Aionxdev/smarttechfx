// src/routes/admin/index.js
import express from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { USER_ROLES } from '../../constants/index.js';

import adminUserRoutes from './admin.user.routes.js';
import adminPlanRoutes from './admin.plan.routes.js';
import adminInvestmentRoutes from './admin.investment.routes.js';
import adminWithdrawalRoutes from './admin.withdrawal.routes.js';
import adminPlatformRoutes from './admin.platform.routes.js';

const router = express.Router();

// All admin routes require authentication and ADMIN role
router.use(verifyJWT);
router.use(authorizeRoles(USER_ROLES.ADMIN));

// Mount admin-specific sub-routes
router.use('/users', adminUserRoutes);
router.use('/plans', adminPlanRoutes);
router.use('/investments', adminInvestmentRoutes);
router.use('/withdrawals', adminWithdrawalRoutes);
router.use('/platform', adminPlatformRoutes); // For settings, announcements, logs etc.


export default router;