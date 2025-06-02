// scripts/seedUsers.js (or part of a larger seed.js)
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.model.js';
import { USER_ROLES, ACCOUNT_STATUS } from '../constants/index.js'; // Adjust path

dotenv.config(); // Adjust path if script is in a subfolder

const MONGODB_URI = process.env.MONGODB_URI;

// Get initial admin credentials from .env or use defaults
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@smarttechfx.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPassword123!';

const usersToSeed = [
    {
        fullName: "Platform Admin",
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD, // Password will be hashed by User model's pre-save hook
        role: USER_ROLES.ADMIN,
        isEmailVerified: true, // Admins usually pre-verified
        status: ACCOUNT_STATUS.ACTIVE,
        country: "Platform HQ",
        // Add other required fields if your User schema mandates them
    }
];

const seedAdminAndSupportUsers = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("MongoDB connected for user seeding.");

        for (const userData of usersToSeed) {
            const existingUser = await User.findOne({ email: userData.email });
            if (!existingUser) {
                // Create user (password will be hashed by pre-save hook)
                await User.create(userData);
                console.log(`User "${userData.fullName}" (${userData.email}) with role ${userData.role} seeded.`);
            } else {
                // Optionally update existing user's role if needed for dev, but be careful
                if (existingUser.role !== userData.role) {
                    // existingUser.role = userData.role;
                    // existingUser.password = userData.password; // To reset password if needed
                    // await existingUser.save();
                    // console.log(`User "${userData.email}" already existed. Role updated to ${userData.role}.`);
                    console.log(`User "${userData.email}" already exists with role ${existingUser.role}. Skipped or check if update needed.`);
                } else {
                    console.log(`User "${userData.email}" already exists with role ${userData.role}. Skipped.`);
                }
            }
        }
        console.log("Admin and Support user seeding completed.");
    } catch (error) {
        console.error("Error seeding users:", error);
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB disconnected.");
    }
};

seedAdminAndSupportUsers();