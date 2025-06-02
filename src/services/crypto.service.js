// src/services/crypto.service.js
import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.util.js';
import ApiError, { BadRequestError, ServiceUnavailableError, NotFoundError } from '../utils/apiError.util.js';
import { HTTP_STATUS_CODES, SUPPORTED_CRYPTO_SYMBOLS } from '../constants/index.js';

// Cache for prices to reduce API calls (simple in-memory cache)
const priceCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const COINMARKETCAP_API_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';
// Fallback for development if API key is missing or for testing
const MOCK_PRICES = { BTC: 60000, ETH: 3500, USDT: 1.00, SOL: 180, MATIC: 0.9, LTC: 120, XRP: 0.6, DOGE: 0.16, BNB: 550, BCH: 450 };


const getMockPrice = (symbol) => {
    return MOCK_PRICES[symbol.toUpperCase()] || null;
};

const fetchPricesFromAPI = async (symbolsArray) => {
    if (!config.apiKeys.coinMarketCap) {
        logger.warn("COINMARKETCAP_API_KEY is not set. Using mock prices for: ", symbolsArray.join(','));
        const results = {};
        symbolsArray.forEach(sym => {
            const mockPrice = getMockPrice(sym);
            if (mockPrice) results[sym.toUpperCase()] = mockPrice;
            else logger.warn(`No mock price for ${sym}`);
        });
        return results; // Return what we have from mocks
    }

    try {
        const response = await axios.get(COINMARKETCAP_API_URL, {
            headers: {
                'X-CMC_PRO_API_KEY': config.apiKeys.coinMarketCap,
                'Accept': 'application/json'
            },
            params: {
                symbol: symbolsArray.join(','),
                convert: 'USD'
            },
            timeout: 10000 // 10 seconds timeout
        });

        const fetchedPrices = {};
        symbolsArray.forEach(s => {
            const symbolUpper = s.toUpperCase();
            const data = response.data.data[symbolUpper];
            if (data && data.quote && data.quote.USD && typeof data.quote.USD.price === 'number') {
                const price = parseFloat(data.quote.USD.price);
                fetchedPrices[symbolUpper] = price;
                priceCache.set(symbolUpper, { price, timestamp: Date.now() }); // Update cache
            } else {
                logger.warn(`Price data not found for ${symbolUpper} in API response from CoinMarketCap.`);
            }
        });
        return fetchedPrices;

    } catch (error) {
        logger.error(`Error fetching prices [${symbolsArray.join(',')}] from CoinMarketCap:`,
            error.response ? { status: error.response.status, data: error.response.data } : error.message);
        // Don't throw here, allow fallback to older cache or mocks if applicable
        return {}; // Indicate failure to fetch new prices
    }
};


export const getCryptoPriceInUSD = async (cryptoSymbol) => {
    const symbolUpper = cryptoSymbol.toUpperCase();
    if (!SUPPORTED_CRYPTO_SYMBOLS.includes(symbolUpper)) {
        throw new BadRequestError(`Cryptocurrency ${cryptoSymbol} is not supported.`);
    }

    const cached = priceCache.get(symbolUpper);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        logger.debug(`Using cached price for ${symbolUpper}: ${cached.price}`);
        return cached.price;
    }

    logger.debug(`Cache miss or expired for ${symbolUpper}. Fetching new price.`);
    const fetchedPrices = await fetchPricesFromAPI([symbolUpper]);

    if (fetchedPrices[symbolUpper] !== undefined) {
        return fetchedPrices[symbolUpper];
    } else if (cached) { // API fetch failed, but we have old cache data
        logger.warn(`API fetch failed for ${symbolUpper}, using stale cached price: ${cached.price}`);
        return cached.price; // Return stale cache as a last resort
    } else { // API fetch failed and no cache
        const mockPrice = getMockPrice(symbolUpper); // Try mock as absolute fallback in dev
        if (config.env !== 'production' && mockPrice) {
            logger.warn(`API fetch failed for ${symbolUpper}, no cache, using mock price: ${mockPrice}`);
            return mockPrice;
        }
        throw new ServiceUnavailableError(`Failed to fetch live price for ${symbolUpper} and no cached/mock data available.`);
    }
};


export const getMultipleCryptoPricesInUSD = async (cryptoSymbols = SUPPORTED_CRYPTO_SYMBOLS) => {
    const uniqueSymbols = [...new Set(cryptoSymbols.map(s => s.toUpperCase()))].filter(s => SUPPORTED_CRYPTO_SYMBOLS.includes(s));
    if (uniqueSymbols.length === 0) return {};

    const results = {};
    const symbolsToFetch = [];

    for (const symbol of uniqueSymbols) {
        const cached = priceCache.get(symbol);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            results[symbol] = cached.price;
        } else {
            symbolsToFetch.push(symbol);
        }
    }

    if (symbolsToFetch.length > 0) {
        logger.debug(`Fetching new prices for: ${symbolsToFetch.join(',')}`);
        const fetchedPrices = await fetchPricesFromAPI(symbolsToFetch);
        for (const symbol of symbolsToFetch) {
            if (fetchedPrices[symbol] !== undefined) {
                results[symbol] = fetchedPrices[symbol];
            } else {
                // If fetch failed for a specific symbol, try to use stale cache or mock
                const staleCached = priceCache.get(symbol);
                if (staleCached) {
                    logger.warn(`API fetch failed for ${symbol} in multi-fetch, using stale cached price: ${staleCached.price}`);
                    results[symbol] = staleCached.price;
                } else if (config.env !== 'production') {
                    const mockPrice = getMockPrice(symbol);
                    if (mockPrice) {
                        logger.warn(`API fetch failed for ${symbol} in multi-fetch, no cache, using mock price: ${mockPrice}`);
                        results[symbol] = mockPrice;
                    } else {
                        results[symbol] = null; // Indicate price not available
                        logger.error(`Could not retrieve price for ${symbol} from any source.`);
                    }
                } else {
                    results[symbol] = null; // Indicate price not available
                    logger.error(`Could not retrieve live price for ${symbol} and no cached data available in production.`);
                }
            }
        }
    }
    logger.info(`Final prices for [${uniqueSymbols.join(',')}]:`, results);
    return results;
};


export const convertUSDToCrypto = async (usdAmount, cryptoSymbol) => {
    if (typeof usdAmount !== 'number' || usdAmount <= 0) {
        throw new BadRequestError("USD amount must be a positive number for conversion.");
    }
    const symbolUpper = cryptoSymbol.toUpperCase();
    const pricePerCryptoInUSD = await getCryptoPriceInUSD(symbolUpper);

    const cryptoAmount = usdAmount / pricePerCryptoInUSD;
    // Precision based on typical crypto values
    let precision = 8;
    if (['USDT', 'USDC'].includes(symbolUpper)) precision = 2; // Stablecoins often 2-6
    else if (['BTC', 'ETH'].includes(symbolUpper)) precision = 8;
    else if (['XRP', 'DOGE'].includes(symbolUpper)) precision = 6;


    return {
        cryptoAmount: parseFloat(cryptoAmount.toFixed(precision)),
        rate: pricePerCryptoInUSD,
        usdAmount: parseFloat(usdAmount.toFixed(2)),
        cryptoSymbol: symbolUpper,
    };
};


export const convertCryptoToUSD = async (cryptoAmount, cryptoSymbol) => {
    if (typeof cryptoAmount !== 'number' || cryptoAmount <= 0) {
        throw new BadRequestError("Crypto amount must be a positive number for conversion.");
    }
    const symbolUpper = cryptoSymbol.toUpperCase();
    const pricePerCryptoInUSD = await getCryptoPriceInUSD(symbolUpper);
    const usdAmount = cryptoAmount * pricePerCryptoInUSD;

    return {
        usdAmount: parseFloat(usdAmount.toFixed(2)),
        rate: pricePerCryptoInUSD,
        cryptoAmount: cryptoAmount, // Original crypto amount
        cryptoSymbol: symbolUpper,
    };
};