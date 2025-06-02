// src/utils/apiResponse.util.js

export class ApiResponse {
    /**
     * Creates an API Response instance.
     * @param {number} statusCode - The HTTP status code for the response.
     * @param {any} data - The data payload of the response.
     * @param {string} message - A success message.
     */
    constructor(statusCode, data, message = "Success") {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400; // Success is true if statusCode is less than 400
    }
}


// Helper function to send response
export const sendSuccessResponse = (res, statusCode, data, message = "Success") => {
    const response = new ApiResponse(statusCode, data, message);
    return res.status(statusCode).json(response);
};

// export default ApiResponse;

// Example usage in a controller:
// import { sendSuccessResponse } from '../utils/apiResponse.util.js';
// import { HTTP_STATUS_CODES } from '../constants/index.js';
//
// const getUser = (req, res) => {
//   const user = { id: 1, name: "Test User" };
//   return sendSuccessResponse(res, HTTP_STATUS_CODES.OK, user, "User retrieved successfully");
// };