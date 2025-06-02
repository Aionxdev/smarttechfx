// src/utils/bcrypt.helper.js
import bcrypt from 'bcryptjs';

/**
 * Hashes data using bcrypt.
 * @param {string | number} data - The data to hash (will be converted to string).
 * @param {number} saltRounds - The number of salt rounds (default is 10).
 * @returns {Promise<string>} - The hashed data.
 */
export const hashData = async (data, saltRounds = 10) => {
    if (data === undefined || data === null) {
        throw new Error("Data to hash cannot be undefined or null.");
    }
    return bcrypt.hash(String(data), saltRounds);
};

/**
 * Compares plain data with hashed data using bcrypt.
 * @param {string | number} data - The plain data to compare (will be converted to string).
 * @param {string} hashedData - The hashed data to compare against.
 * @returns {Promise<boolean>} - True if data matches hashedData, false otherwise.
 */
export const compareData = async (data, hashedData) => {
    if (data === undefined || data === null || !hashedData) {
        return false; // Cannot compare if plain data or hashed data is missing
    }
    return bcrypt.compare(String(data), hashedData);
};