import {conversationSupportService} from '../services/index.js';
import { ApiResponse, ApiError } from '../utils/index.js';
import logger from '../utils/logger.util.js';

// For agents to get their list of conversations (pending, active, etc.)
export const getAgentConversations = async (req, res) => {
    // req.agent is populated by verifySupportAgentJWT
    // queryOptions will come from req.query after validation
    const { status, page, limit, sortBy, sortOrder, guestEmail } = req.query;

    // Agents should typically only see their own conversations or general pending ones.
    // Admins might see more. This logic should be enforced in the service or here.
    let agentIdForFilter = null;
    if (req.agent.role === 'support_agent') {
        agentIdForFilter = req.agent._id.toString();
    } else if (req.agent.role === 'support_admin' && req.query.agentId) {
        // Admin can filter by a specific agentId if provided in query
        agentIdForFilter = req.query.agentId;
    }
    // If no specific agentId filter for admin, service might fetch all for a status or based on other criteria.

    const result = await conversationSupportService.getAgentConversationsService(
        agentIdForFilter,
        { status, page, limit, sortBy, sortOrder, guestEmail }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, result, "Conversations fetched successfully"));
};

// For an agent to get full details of a single conversation, including messages
export const getConversationDetails = async (req, res) => {
    const { conversationId } = req.params;
    const conversationDetails = await conversationSupportService.getConversationDetailsService(
        conversationId,
        req.agent._id.toString(), // Pass current agent's ID for authorization checks
        req.agent.role          // Pass current agent's role
    );
    return res
        .status(200)
        .json(new ApiResponse(200, conversationDetails, "Conversation details fetched successfully"));
};

// For an agent to update the status of a conversation (e.g., 'resolved', 'on_hold')
export const updateConversationStatusByAgent = async (req, res) => {
    const { conversationId } = req.params;
    const { status /* any other relevant body params like feedback, rating */ } = req.body;
    const agentId = req.agent._id.toString();
    const agentRole = req.agent.role;

    const updatedConversation = await conversationSupportService.updateConversationStatusByAgentService(
        conversationId,
        agentId,
        status,
        agentRole
    );

    // Emit socket event here or in service
    if (global.supportNamespace) { // Check if socket namespace is initialized
        global.supportNamespace.to(`conversation_${conversationId}`).emit('conversation:status_updated', {
            conversationId,
            newStatus: updatedConversation.status,
            agentId: agentId,
            agentName: req.agent.firstName || req.agent.username
        });
        // Also notify the agent who made the change if needed, or all agents observing this chat
        global.supportNamespace.to(`agent_${agentId}`).emit('conversation:status_updated_by_you', {
            conversationId,
            newStatus: updatedConversation.status
        });
    } else {
        logger.warn('Support socket namespace not initialized. Cannot emit conversation:status_updated event.');
    }


    return res
        .status(200)
        .json(new ApiResponse(200, updatedConversation, "Conversation status updated successfully by agent"));
};

// Note: Adding messages is typically handled via Socket.IO, not a direct HTTP endpoint for agents usually.
// If you needed an HTTP endpoint for messages (e.g., for an admin to add a note):
// export const addMessageByAgentHttp = async (req, res) => { /* ... */ }