/**
 * AI Chat System Configuration
 * All settings for the AI chatbot feature
 */

module.exports = {
  // ===== FEATURE TOGGLE =====
  AI_ENABLED: true,                     // Master switch to enable/disable AI chat
  AI_MIN_CONCURRENT_USERS: 5,           // Disable AI when more than X real users online
  
  // ===== QUEUE TIMING =====
  MIN_QUEUE_WAIT: 10000,                // Minimum wait before AI match (10 seconds)
  MAX_QUEUE_WAIT: 20000,                // Maximum wait before AI match (20 seconds)
  AI_POLL_INTERVAL: 5000,               // Check for real users every 5 seconds during AI chat
  
  // ===== AI RESPONSE BEHAVIOR =====
  AI_RESPONSE_DELAY_MIN: 2000,          // Minimum delay before AI responds (2 seconds)
  AI_RESPONSE_DELAY_MAX: 8000,          // Maximum delay before AI responds (8 seconds)
  
  // ===== FIRST MESSAGE BEHAVIOR =====
  FIRST_MESSAGE_PROBABILITY: 0.65,      // 65% chance AI messages first
  FIRST_MESSAGE_DELAY_MIN: 2000,        // Minimum delay before first message (2 seconds)
  FIRST_MESSAGE_DELAY_MAX: 6000,        // Maximum delay before first message (6 seconds)
  
  // ===== OPENAI SETTINGS =====
  OPENAI_MODEL: 'gpt-4o-mini',          // Model to use (better instruction following than 3.5-turbo)
  OPENAI_TEMPERATURE: 0.9,              // Higher = more random/creative (0-2)
  OPENAI_MAX_TOKENS: 150,               // Max response length
  OPENAI_TOP_P: 1,                      // Nucleus sampling parameter
  OPENAI_FREQUENCY_PENALTY: 0.3,        // Reduce repetition
  OPENAI_PRESENCE_PENALTY: 0.3,         // Encourage topic diversity
  
  // ===== HUMAN-LIKE BEHAVIOR =====
  TYPO_PROBABILITY: 0.07,               // 7% chance of typo per message
  LOWERCASE_PROBABILITY: 0.4,           // 40% chance of lowercase message
  IGNORE_PROBABILITY: 0,                // Disabled - AI always responds
  SHORT_RESPONSE_PROBABILITY: 0.3,      // 30% chance of very short response
  
  // ===== EXIT STRATEGIES =====
  // Weights for how AI ends conversations
  EXIT_STRATEGIES: {
    GHOST: 0.80,                        // 70% - Just disconnect (most realistic)
    GTG: 0.10,                          // 10% - "gtg" or "gotta go"
    NATURAL: 0.10,                      // 10% - Natural exit message
  },
  
  NATURAL_EXIT_MESSAGES: [
    "gtg, nice talking to you!!",
    "take care!",
    "oop bye lol",
    "parents calling, see ya",
    "my food just got here lol bye",
  ],
  
  // ===== CONVERSATION LIMITS =====
  MAX_CONVERSATION_LENGTH: 50,          // End after 50 messages total
  MAX_CONVERSATION_TIME: 600000,        // End after 10 minutes (milliseconds)
  MIN_CONVERSATION_LENGTH: 3,           // Must have at least 3 exchanges before ending
  
  // ===== AUTONOMOUS LEAVING =====
  AUTONOMOUS_LEAVING_ENABLED: true,     // Allow AI to decide when to leave conversations
  MIN_MESSAGES_BEFORE_AUTONOMOUS_LEAVE: 4, // AI must respond at least 4 times before it can autonomously leave
  
  // ===== SAFETY & MONITORING =====
  LOG_AI_CONVERSATIONS: true,           // Log AI conversations for monitoring
  MAX_RETRIES: 3,                       // Max retries for OpenAI API failures
  API_TIMEOUT: 30000,                   // 30 second timeout for API calls
};
