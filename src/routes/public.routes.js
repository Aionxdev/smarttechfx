// src/routes/public.routes.js
import express from 'express';
import { cryptoService } from '../services/index.js'; // Direct service call for simple public data
import { getActiveInvestmentPlansForUser } from '../services/plan.service.js'; // For public plan listing
import { ApiResponse, sendSuccessResponse } from '../utils/apiResponse.util.js';
import { HTTP_STATUS_CODES } from '../constants/index.js';
import asyncHandler from '../utils/asyncHandler.util.js';
import { getPublicInvestmentPlanGuide } from '../controllers/investment.controller.js'; // Ensure path is correct
import { getCryptoMarketPrices } from '../controllers/public.controller.js'; // Create this controller


const router = express.Router();

// Live Crypto Price Ticker (from CoinMarketCap via crypto.service)
router.get('/crypto-prices', asyncHandler(async (req, res) => {
    // Symbols can be passed as query param, e.g., /crypto-prices?symbols=BTC,ETH,USDT
    let symbols = req.query.symbols ? req.query.symbols.split(',').map(s => s.trim().toUpperCase()) : undefined;
    const prices = await cryptoService.getMultipleCryptoPricesInUSD(symbols); // symbols undefined will use defaults from service
    return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, prices, "Cryptocurrency prices fetched.");
}));

// Public listing of active investment plans
router.get('/investment-plan-guide', asyncHandler(getPublicInvestmentPlanGuide));

router.get('/crypto-prices-free', getCryptoMarketPrices);

export default router;