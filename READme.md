# SmartTechFX - Backend

This is the backend server for the SmartTechFX Cryptocurrency Investment Platform.

## 🔷 Project Overview

SmartTechFX is a secure and user-friendly crypto-based investment platform where users invest in USD-equivalent plans, pay using supported cryptocurrencies, and receive returns after specified periods. The platform supports real-time market pricing, performance tracking, and intelligent AI-powered customer service.

## 🛠️ Technologies Used

-   Node.js
-   Express.js
-   MongoDB (with Mongoose)
-   JSON Web Tokens (JWT) for authentication
-   Bcrypt.js for password hashing
-   CoinMarketCap API for crypto prices
-   Gemini API for AI chat
-   Nodemailer for email notifications
-   (Potentially Redis for OTPs/caching via Upstash)

## ⚙️ Prerequisites

-   Node.js (v18.x or later recommended)
-   Yarn (or npm)
-   MongoDB Atlas account (or a local MongoDB instance)
-   API keys for CoinMarketCap and Gemini

## 🚀 Getting Started

1.  **Clone the repository (if applicable):**
    ```bash
    git clone <repository-url>
    cd smarttechfx-backend
    ```

2.  **Install dependencies:**
    ```bash
    yarn install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root directory by copying `.env.example` (if provided) or using the structure below. Fill in your specific configurations.
    ```bash
    cp .env.example .env # if .env.example exists
    ```
    Key variables to configure:
    -   `MONGODB_URI`
    -   `JWT_SECRET`
    -   `COINMARKETCAP_API_KEY`
    -   `GEMINI_API_KEY`
    -   `EMAIL_USER`, `EMAIL_PASS` (for Gmail SMTP)

4.  **Run the development server:**
    ```bash
    yarn dev
    ```
    The server will typically start on the port specified in your `.env` file (e.g., `http://localhost:5001`).

5.  **Run the production server:**
    ```bash
    yarn start
    ```

## API Endpoints

(To be documented here as they are developed - e.g., using Postman collections or Swagger/OpenAPI specs)

-   `POST /api/v1/auth/register` - User registration
-   `POST /api/v1/auth/login` - User login
-   ...

## Folder Structure

(A brief overview of the `src` directory structure can be added here if desired)

## 🔐 Security

-   Environment variables are managed via `.env` files.
-   Passwords are hashed using bcrypt.
-   Authentication is handled using JWT.
-   Input validation is performed on incoming requests.

## 📄 License

- MIT