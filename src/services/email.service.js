// src/services/email.service.js
import nodemailer from 'nodemailer';
// import { google } from 'googleapis'; // Keep for OAuth2 if/when needed
import config from '../config/index.js';
import logger from '../utils/logger.util.js';

// Basic SMTP transporter setup (using App Password for Gmail during dev is fine)
const createBasicTransporter = () => {
    if (!config.email.auth.user || !config.email.auth.pass) {
        logger.warn("Email auth credentials (EMAIL_USER, EMAIL_PASS) are not configured. Email sending will be skipped.");
        return null; // Indicate that transporter cannot be created
    }
    try {
        return nodemailer.createTransport({
            host: config.email.host,
            port: config.email.port,
            secure: config.email.secure,
            requireTLS: true, // Explicitly require STARTTLS
            auth: {
                user: config.email.auth.user,
                pass: config.email.auth.pass,
            },
            // Add a timeout to prevent hanging if the SMTP server is unresponsive
            connectionTimeout: 15000, // 5 seconds
            greetingTimeout: 15000, // 5 seconds
            socketTimeout: 15000, // 5 seconds
        });
    } catch (error) {
        logger.error("Error creating basic email transporter:", error);
        return null;
    }
};

let transporter = createBasicTransporter(); // Initialize once

// Function to re-initialize transporter if needed (e.g., config changes, though unlikely at runtime)
export const initializeEmailService = () => {
    transporter = createBasicTransporter();
    if (transporter) {
        logger.info("Email service initialized.");
    } else {
        logger.warn("Email service could not be initialized (check config).");
    }
};
initializeEmailService(); // Call on module load

/**
 * Sends an email.
 * @param {string} to - Recipient's email address.
 * @param {string} subject - Email subject.
 * @param {string} textBody - Plain text body of the email.
 * @param {string} htmlBody - HTML body of the email.
 * @returns {Promise<boolean>} - True if email sent successfully, false otherwise.
 */
export const sendEmail = async (to, subject, textBody, htmlBody) => {
    if (config.env === 'test' && !process.env.FORCE_EMAIL_IN_TEST) {
        logger.info(`[TEST ENV] Mock email send to: ${to}, subject: ${subject}`);
        return true;
    }

    if (!transporter) {
        logger.error("Email transporter is not available. Cannot send email.");
        return false;
    }

    const mailOptions = {
        from: config.email.fromNoReply,
        to: to,
        subject: subject,
        text: textBody,
        html: htmlBody,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Email sent successfully to ${to}. Message ID: ${info.messageId}`);
        return true;
    } catch (error) {
        logger.error(`Failed to send email to ${to} for subject "${subject}":`, error);
        // More detailed error logging
        if (error.responseCode) logger.error(`SMTP Error Code: ${error.responseCode}, Response: ${error.response}`);
        return false;
    }
};

export const sendOtpEmail = async (to, otp, purposeDescription) => {
    const subject = `Your OTP for ${config.appName}: ${purposeDescription}`;
    const textBody = `Hello,\n\nYour One-Time Password (OTP) for ${purposeDescription} on ${config.appName} is: ${otp}\n\nThis OTP is valid for ${config.otp.expiryMinutes} minutes.\n\nIf you did not request this, please ignore this email.\n\nThanks,\nThe ${config.appName} Team`;
    const htmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>Hi there,</p>
            <p>Your One-Time Password (OTP) for <strong>${purposeDescription}</strong> on <strong>${config.appName}</strong> is:</p>
            <h1 style="font-size: 28px; color: #333; margin: 10px 0;">${otp}</h1>
            <p>This OTP is valid for <strong>${config.otp.expiryMinutes} minutes</strong>.</p>
            <p>If you did not request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 0.9em; color: #777;">Thanks,<br/>The ${config.appName} Team</p>
        </div>`;
    return sendEmail(to, subject, textBody, htmlBody);
};

export const sendWelcomeEmail = async (to, fullName) => {
    const subject = `Welcome to ${config.appName}!`;
    const textBody = `Hi ${fullName},\n\nWelcome to ${config.appName}! We're excited to have you on board.\n\nExplore our platform and start your investment journey today.\n\nIf you have any questions, don't hesitate to contact our support team.\n\nBest regards,\nThe ${config.appName} Team`;
    const htmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>Hi ${fullName},</p>
            <p>Welcome to <strong>${config.appName}</strong>! We're thrilled to have you join our community of investors.</p>
            <p>Here are a few things you can do to get started:</p>
            <ul>
                <li>Complete your profile information.</li>
                <li>Explore our diverse range of investment plans.</li>
                <li>Familiarize yourself with our secure deposit and withdrawal process.</li>
            </ul>
            <p>Our AI Assistant and support team are available 24/7 to help you with any queries.</p>
            <p>We wish you a successful investment journey with us!</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 0.9em; color: #777;">Best regards,<br/>The ${config.appName} Team</p>
        </div>`;
    return sendEmail(to, subject, textBody, htmlBody);
};

// More specific emails
export const sendPasswordResetEmail = async (to, resetToken) => {
    // Construct the reset link using CLIENT_URL from config
    const resetLink = `${config.clientURL}/reset-password?token=${resetToken}`;
    const subject = `Password Reset Request for ${config.appName}`;
    const textBody = `Hello,\n\nYou requested a password reset for your ${config.appName} account.\nClick the link below to reset your password:\n${resetLink}\n\nThis link is valid for a limited time.\nIf you did not request this, please ignore this email.\n\nThanks,\nThe ${config.appName} Team`;
    const htmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>Hi there,</p>
            <p>We received a request to reset the password for your <strong>${config.appName}</strong> account associated with this email address.</p>
            <p>To reset your password, please click the button below:</p>
            <p style="text-align: center; margin: 20px 0;">
                <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px;">Reset Password</a>
            </p>
            <p>If the button doesn't work, you can copy and paste the following link into your browser:</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>This link is valid for a limited time (usually 1 hour). After that, you'll need to request another reset.</p>
            <p>If you did not request a password reset, please ignore this email or contact our support if you have concerns.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 0.9em; color: #777;">Thanks,<br/>The ${config.appName} Team</p>
        </div>`;
    return sendEmail(to, subject, textBody, htmlBody);
};

export const sendInvestmentConfirmationEmail = async (to, investmentDetails) => {
    const subject = `Your Investment on ${config.appName} is Confirmed!`;
    const textBody = `Dear Investor,\n\nYour investment in the ${investmentDetails.planName} plan for $${investmentDetails.amountUSD} has been successfully confirmed and activated.\nInvestment ID: ${investmentDetails.id}\nMaturity Date: ${new Date(investmentDetails.maturityDate).toLocaleDateString()}\n\nYou can track its progress in your dashboard.\n\nHappy investing,\nThe ${config.appName} Team`;
    const htmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>Dear Investor,</p>
            <p>We're pleased to inform you that your investment on <strong>${config.appName}</strong> has been successfully confirmed and activated!</p>
            <h3 style="color: #28a745;">Investment Details:</h3>
            <ul>
                <li><strong>Investment ID:</strong> ${investmentDetails.id}</li>
                <li><strong>Plan Name:</strong> ${investmentDetails.planName}</li>
                <li><strong>Invested Amount:</strong> $${investmentDetails.amountUSD.toFixed(2)}</li>
                <li><strong>Paid via:</strong> ${investmentDetails.paymentAmountCrypto} ${investmentDetails.paymentCryptocurrency}</li>
                <li><strong>Activation Date:</strong> ${new Date(investmentDetails.activationDate).toLocaleString()}</li>
                <li><strong>Maturity Date:</strong> ${new Date(investmentDetails.maturityDate).toLocaleString()}</li>
                <li><strong>Expected Total Return:</strong> $${investmentDetails.expectedTotalReturnUSD.toFixed(2)}</li>
            </ul>
            <p>You can monitor the progress of your investment in your dashboard. If you have any questions, our support team is ready to assist you.</p>
            <p style="text-align: center; margin: 20px 0;">
                <a href="${config.clientURL}/dashboard/my-plans" style="background-color: #17a2b8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px;">View My Investments</a>
            </p>
            <p>Thank you for choosing ${config.appName}. Happy investing!</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 0.9em; color: #777;">Warm regards,<br/>The ${config.appName} Team</p>
        </div>`;
    return sendEmail(to, subject, textBody, htmlBody);
};

// ... other email templates for withdrawal processed, KYC status change, etc. ...