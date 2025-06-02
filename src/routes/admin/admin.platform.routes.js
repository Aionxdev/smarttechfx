// src/routes/admin/admin.platform.routes.js
import express from 'express';
import {
    manageSupportedCryptos,
    updateSupportedCrypto,
    broadcastAnnouncement,
    getPlatformAnalytics,
    viewSystemLogs,
    getAdminDashboardOverview,
    getAllAnnouncementsAdmin,
    deleteAnnouncementAdmin
} from '../../controllers/admin.controller.js';
import {
    // Define validators for these if complex:
    // addSupportedCryptoValidator, updateSupportedCryptoValidator, broadcastAnnouncementValidator
} from '../../validators/index.js'; // Or create in admin.validator.js
import { validate } from '../../middlewares/validation.middleware.js';
import asyncHandler from '../../utils/asyncHandler.util.js';

const router = express.Router();

router.get('/dashboard-overview', asyncHandler(getAdminDashboardOverview));
router.get('/analytics', asyncHandler(getPlatformAnalytics));
router.get('/logs', asyncHandler(viewSystemLogs));

router.route('/supported-cryptos')
    .get(asyncHandler(manageSupportedCryptos))    // GET to list
    .post(asyncHandler(manageSupportedCryptos));  // POST to add (controller logic will differentiate)

router.put('/supported-cryptos/:cryptoId', asyncHandler(updateSupportedCrypto)); // cryptoId is Mongo ObjectId

router.post('/broadcast', asyncHandler(broadcastAnnouncement));

router.get('/announcements', asyncHandler(getAllAnnouncementsAdmin));

router.delete('/announcements/:notificationId', asyncHandler(deleteAnnouncementAdmin));

export default router;