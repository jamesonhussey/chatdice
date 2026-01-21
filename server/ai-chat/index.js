/**
 * AI Chat Module
 * Main entry point for AI chat functionality
 */

const ConversationManager = require('./services/conversation-manager');
const config = require('./config/settings');
require('dotenv').config();

class AIChatModule {
  constructor() {
    this.conversationManager = null;
    this.queuedUsers = new Map(); // Users waiting for AI match
    this.pollIntervals = new Map(); // Polling intervals for each user
  }

  /**
   * Initialize the AI chat module
   */
  initialize() {
    if (!config.AI_ENABLED) {
      console.log('⚠️  AI Chat is disabled in config');
      return;
    }

    const apiKey = process.env.OPEN_AI_KEY;
    
    if (!apiKey) {
      console.error('❌ OPEN_AI_KEY not found in environment variables');
      console.error('   Please add OPEN_AI_KEY to your .env file');
      return;
    }

    this.conversationManager = new ConversationManager(apiKey);
    console.log('✓ AI Chat Module initialized');

    // Start cleanup interval
    setInterval(() => {
      this.conversationManager.cleanupStaleConversations();
    }, 60000); // Every minute
  }

  /**
   * Check if AI chat is available
   * @returns {boolean} - True if AI is enabled and initialized
   */
  isAvailable() {
    return config.AI_ENABLED && this.conversationManager !== null;
  }

  /**
   * Queue user for AI match after delay
   * @param {string} userId - Socket ID
   * @param {Function} matchCallback - Called when AI match is ready
   * @param {Function} realUserCallback - Called when real user becomes available
   * @returns {number} - Queue wait time in milliseconds
   */
  queueForAIMatch(userId, matchCallback, realUserCallback) {
    if (!this.isAvailable()) {
      console.log('⚠️  AI Chat not available for queue');
      return 0;
    }

    // Calculate random wait time
    const waitTime = Math.floor(
      Math.random() * (config.MAX_QUEUE_WAIT - config.MIN_QUEUE_WAIT) + config.MIN_QUEUE_WAIT
    );

    console.log(`⏱️  User ${userId} queued for AI match in ${(waitTime/1000).toFixed(1)}s`);

    // Store queue info
    this.queuedUsers.set(userId, {
      queueTime: Date.now(),
      matchCallback,
      realUserCallback
    });

    // Set timer for AI match
    const matchTimer = setTimeout(() => {
      const queueInfo = this.queuedUsers.get(userId);
      if (queueInfo) {
        // User still queued, match with AI
        this.matchWithAI(userId, matchCallback, realUserCallback);
      }
    }, waitTime);

    // Store timer for cleanup
    this.queuedUsers.get(userId).matchTimer = matchTimer;

    return waitTime;
  }

  /**
   * Match user with AI bot
   * @param {string} userId - Socket ID
   * @param {Function} matchCallback - Called to notify match
   * @param {Function} realUserCallback - Called when real user becomes available
   */
  matchWithAI(userId, matchCallback, realUserCallback) {
    console.log(`🤖 Matching user ${userId} with AI bot`);

    // Start conversation
    const conversation = this.conversationManager.startConversation(userId);

    // Notify user of match
    matchCallback({
      isAI: true,
      personality: conversation.personality.name
    });

    // Start polling for real users
    this.startPollingForRealUser(userId, realUserCallback);

    // Remove from queue
    this.queuedUsers.delete(userId);
  }

  /**
   * Start polling for real users while in AI chat
   * @param {string} userId - Socket ID
   * @param {Function} callback - Called when real user is available
   */
  startPollingForRealUser(userId, callback) {
    const pollInterval = setInterval(() => {
      // Callback checks if real user is available
      const realUserAvailable = callback();

      if (realUserAvailable) {
        console.log(`✅ Real user found for ${userId}, ending AI chat`);
        this.endAIChat(userId, 'real-user-found');
        clearInterval(pollInterval);
        this.pollIntervals.delete(userId);
      }
    }, config.AI_POLL_INTERVAL);

    this.pollIntervals.set(userId, pollInterval);
  }

  /**
   * Cancel queued AI match (real user found before AI match)
   * @param {string} userId - Socket ID
   */
  cancelQueuedMatch(userId) {
    const queueInfo = this.queuedUsers.get(userId);
    
    if (queueInfo) {
      clearTimeout(queueInfo.matchTimer);
      this.queuedUsers.delete(userId);
      console.log(`⏱️  Cancelled AI queue for user ${userId} (real user found)`);
    }
  }

  /**
   * Handle message from user to AI
   * @param {string} userId - Socket ID
   * @param {string} message - User's message
   * @returns {Promise<Object>} - Response object
   */
  async handleUserMessage(userId, message) {
    if (!this.conversationManager.hasConversation(userId)) {
      throw new Error(`No AI conversation for user ${userId}`);
    }

    return await this.conversationManager.getResponse(userId, message);
  }

  /**
   * End AI chat for user
   * @param {string} userId - Socket ID
   * @param {string} reason - Reason for ending
   */
  endAIChat(userId, reason = 'normal') {
    // Clear polling interval
    const pollInterval = this.pollIntervals.get(userId);
    if (pollInterval) {
      clearInterval(pollInterval);
      this.pollIntervals.delete(userId);
    }

    // End conversation
    if (this.conversationManager) {
      this.conversationManager.endConversation(userId, reason);
    }

    // Clean up queue if still there
    this.cancelQueuedMatch(userId);
  }

  /**
   * Check if user is in AI conversation
   * @param {string} userId - Socket ID
   * @returns {boolean} - True if in AI conversation
   */
  isInAIChat(userId) {
    return this.conversationManager && this.conversationManager.hasConversation(userId);
  }

  /**
   * Get statistics
   * @returns {Object} - AI chat statistics
   */
  getStats() {
    return {
      enabled: this.isAvailable(),
      activeConversations: this.conversationManager ? this.conversationManager.getActiveCount() : 0,
      queuedUsers: this.queuedUsers.size,
      pollingUsers: this.pollIntervals.size
    };
  }
}

// Export singleton instance
module.exports = new AIChatModule();
