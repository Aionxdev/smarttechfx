// src/config/index.js
import appConfig from './app.config.js';
import connectDB from './db.config.js';

// If you add more config files in the future (e.g., logger.config.js), import and export them here.

const config = {
    ...appConfig, // Spread appConfig properties directly into the exported config object
    connectDB,    // Make connectDB function available
};

export default config;

// You can also export them individually if preferred:
// export { default as appConfig } from './app.config.js';
// export { default as connectDB } from './db.config.js';