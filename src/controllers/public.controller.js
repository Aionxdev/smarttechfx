// src/controllers/public.controller.js
import axios from 'axios';
import { ApiResponse } from '../utils/apiResponse.util.js';
import logger from '../utils/logger.util.js';

// Define your CoinGecko IDs here or pass them as query params from frontend
const COINGECKO_COIN_IDS_BACKEND = [
    'bitcoin', 'ethereum', 'tether', 'binancecoin', 'ripple', 'cardano',
    'solana', 'polkadot', 'dogecoin', 'matic-network', 'litecoin', 'avalanche-2',
    'tron', 'shiba-inu', 'chainlink'
];

export const getCryptoMarketPrices = async (req, res) => {
    try {
        // Optional: Allow frontend to specify coin IDs via query param, otherwise use default
        const idsToFetch = req.query.ids ? req.query.ids.split(',') : COINGECKO_COIN_IDS_BACKEND;
        const idsQueryParam = idsToFetch.join(',');

        const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
            params: {
                vs_currency: 'usd',
                ids: idsQueryParam,
                order: 'market_cap_desc',
                per_page: idsToFetch.length,
                page: 1,
                sparkline: false,
                price_change_percentage: '24h'
            }
        });

        if (response.data && Array.isArray(response.data)) {
            return res.status(200).json(new ApiResponse(200, response.data, "Crypto market data fetched successfully."));
        } else {
            logger.warn("Backend: CoinGecko API did not return expected array data.", response.data);
            throw new ApiError(502, "Failed to fetch valid data from price provider.");
        }

    } catch (error) {
        let errorMessage = 'Failed to fetch crypto market prices.';
        let statusCode = 500;
        if (error.response) { // Error from CoinGecko API itself
            logger.error("Backend: CoinGecko API Error", { status: error.response.status, data: error.response.data });
            errorMessage = `Error from price provider: ${error.response.data?.error || error.response.statusText}`;
            statusCode = error.response.status === 429 ? 429 : 502; // Handle rate limiting or bad gateway
        } else if (error.request) { // No response received
            logger.error("Backend: No response from CoinGecko API", error.request);
            errorMessage = "Price provider is unreachable.";
            statusCode = 504; // Gateway timeout
        } else { // Other errors
            logger.error("Backend: Error fetching crypto prices", error.message);
        }
        // Use your standard error handling if ApiError is passed to next() by express-async-errors
        // For direct response here:
        return res.status(statusCode).json({ success: false, message: errorMessage, data: null });
        // Or: throw new ApiError(statusCode, errorMessage); if your errorHandler middleware handles it.
    }
};