// src/config/db.config.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config(); // Ensure .env variables are loaded

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("FATAL ERROR: MONGODB_URI is not defined in .env file. Server cannot start.");
    process.exit(1); // Exit if DB URI is not set
}

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            // Mongoose 6+ no longer needs most of these options,
            // but they don't hurt if included.
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
            // useCreateIndex: true, // Not supported in Mongoose 6+
            // useFindAndModify: false, // Not supported in Mongoose 6+
        });
        console.log('MongoDB Connected Successfully...');

        // Optional: Listen for connection events
        mongoose.connection.on('error', (err) => {
            console.error(`MongoDB connection error: ${err}`);
            // process.exit(1); // Optionally exit on persistent connection errors
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected.');
        });

    } catch (err) {
        console.error(`MongoDB Connection Failed: ${err.message}`);
        // Exit process with failure
        process.exit(1);
    }
};

export default connectDB;