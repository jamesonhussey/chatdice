/**
 * Conversation Manager
 * Manages individual AI conversations with users
 */

const OpenAIClient = require('./openai-client');
const PersonalitySelector = require('./personality-selector');
const HumanBehavior = require('./human-behavior');
const config = require('../config/settings');

class ConversationManager {
  constructor(apiKey) {
    this.openaiClient = new OpenAIClient(apiKey);
    this.personalitySelector = new PersonalitySelector();
    this.activeConversations = new Map();
  }

  /**
   * Start a new AI conversation
   * @param {string} userId - Socket ID of the user
   * @returns {Object} - Conversation metadata
   */
  startConversation(userId) {
    if (this.activeConversations.has(userId)) {
      console.log(`⚠️  Conversation already exists for user ${userId}`);
      return this.activeConversations.get(userId);
    }

    const personality = this.personalitySelector.selectRandomPersonality();
    
    const conversation = {
      userId,
      personality,
      messages: [
        {
          role: 'system',
          content: personality.prompt
        }
      ],
      messageCount: 0,
      startTime: Date.now(),
      lastMessageTime: Date.now()
    };

    this.activeConversations.set(userId, conversation);
    console.log(`🤖 Started AI conversation for user ${userId} (${personality.name})`);

    return conversation;
  }

  /**
   * Get AI response to user message
   * @param {string} userId - Socket ID of the user
   * @param {string} userMessage - User's message
   * @returns {Promise<Object>} - {response: string, delay: number, shouldEnd: boolean}
   */
  async getResponse(userId, userMessage) {
    const conversation = this.activeConversations.get(userId);
    
    if (!conversation) {
      throw new Error(`No active conversation for user ${userId}`);
    }

    // Check if should ignore message
    if (HumanBehavior.shouldIgnoreMessage()) {
      console.log(`🤖 AI ignoring message from ${userId} (realistic behavior)`);
      return {
        response: null,
        delay: 0,
        shouldEnd: false
      };
    }

    // Add user message to conversation history
    conversation.messages.push({
      role: 'user',
      content: userMessage
    });

    conversation.messageCount++;
    conversation.lastMessageTime = Date.now();

    // Check if should end conversation
    const shouldEnd = this.shouldEndConversation(conversation);
    if (shouldEnd) {
      const exitStrategy = HumanBehavior.selectExitStrategy();
      
      if (exitStrategy.message) {
        // Send exit message then disconnect
        return {
          response: exitStrategy.message,
          delay: HumanBehavior.calculateResponseDelay(userMessage),
          shouldEnd: true,
          exitType: exitStrategy.type
        };
      } else {
        // Just ghost (disconnect without message)
        return {
          response: null,
          delay: 0,
          shouldEnd: true,
          exitType: 'GHOST'
        };
      }
    }

    try {
      // Get AI response
      const rawResponse = await this.openaiClient.getChatCompletionWithRetry(
        conversation.messages
      );

      // Humanize the response
      const humanizedResponse = HumanBehavior.humanize(rawResponse);

      // Add to conversation history
      conversation.messages.push({
        role: 'assistant',
        content: humanizedResponse
      });

      // Calculate realistic delay
      const delay = HumanBehavior.calculateResponseDelay(userMessage);

      if (config.LOG_AI_CONVERSATIONS) {
        console.log(`🤖 AI (${conversation.personality.name}) → User ${userId}: "${humanizedResponse}"`);
      }

      return {
        response: humanizedResponse,
        delay,
        shouldEnd: false
      };

    } catch (error) {
      console.error(`❌ OpenAI error for user ${userId}:`, error.message);
      
      // Fallback response on error
      const fallbackResponses = [
        'lol yeah',
        'fair enough',
        'same tbh',
        'true',
        'haha yeah',
        'i feel that'
      ];
      
      return {
        response: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
        delay: 3000,
        shouldEnd: false,
        isError: true
      };
    }
  }

  /**
   * Determine if conversation should end
   * @param {Object} conversation - Conversation object
   * @returns {boolean} - True if should end
   */
  shouldEndConversation(conversation) {
    const duration = Date.now() - conversation.startTime;
    const messageCount = conversation.messageCount;

    // Must have minimum messages before ending
    if (messageCount < config.MIN_CONVERSATION_LENGTH) {
      return false;
    }

    // End if max time reached
    if (duration >= config.MAX_CONVERSATION_TIME) {
      return true;
    }

    // End if max messages reached
    if (messageCount >= config.MAX_CONVERSATION_LENGTH) {
      return true;
    }

    return false;
  }

  /**
   * End a conversation
   * @param {string} userId - Socket ID of the user
   * @param {string} reason - Reason for ending
   */
  endConversation(userId, reason = 'normal') {
    const conversation = this.activeConversations.get(userId);
    
    if (conversation) {
      const duration = Date.now() - conversation.startTime;
      const durationMinutes = (duration / 60000).toFixed(1);
      
      console.log(`🤖 Ended AI conversation for user ${userId} (${reason}, ${conversation.messageCount} messages, ${durationMinutes}min)`);
      
      this.activeConversations.delete(userId);
    }
  }

  /**
   * Check if user has active conversation
   * @param {string} userId - Socket ID
   * @returns {boolean} - True if has active conversation
   */
  hasConversation(userId) {
    return this.activeConversations.has(userId);
  }

  /**
   * Get conversation for user
   * @param {string} userId - Socket ID
   * @returns {Object|null} - Conversation or null
   */
  getConversation(userId) {
    return this.activeConversations.get(userId) || null;
  }

  /**
   * Get all active conversation count
   * @returns {number} - Number of active AI conversations
   */
  getActiveCount() {
    return this.activeConversations.size;
  }

  /**
   * Clean up stale conversations (called periodically)
   */
  cleanupStaleConversations() {
    const now = Date.now();
    const maxAge = config.MAX_CONVERSATION_TIME * 2; // Double the max time
    
    for (const [userId, conversation] of this.activeConversations.entries()) {
      const age = now - conversation.lastMessageTime;
      if (age > maxAge) {
        console.log(`🧹 Cleaning up stale AI conversation for user ${userId}`);
        this.endConversation(userId, 'stale');
      }
    }
  }
}

module.exports = ConversationManager;
