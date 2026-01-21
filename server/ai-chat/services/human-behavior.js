/**
 * Human Behavior Simulator
 * Makes AI responses feel more human-like
 */

const config = require('../config/settings');

class HumanBehavior {
  /**
   * Add occasional typos to make text more human
   * @param {string} text - Original text
   * @returns {string} - Text with potential typos
   */
  static addTypos(text) {
    if (Math.random() > config.TYPO_PROBABILITY) {
      return text;
    }

    const typoPatterns = [
      { from: 'the', to: 'teh' },
      { from: 'you', to: 'u' },
      { from: 'are', to: 'r' },
      { from: 'your', to: 'ur' },
      { from: 'what', to: 'wht' },
      { from: 'that', to: 'taht' },
      { from: 'just', to: 'jsut' },
      { from: 'like', to: 'liek' },
      { from: 'and', to: 'nd' },
      { from: 'with', to: 'w/' },
    ];

    // Apply one random typo
    const pattern = typoPatterns[Math.floor(Math.random() * typoPatterns.length)];
    const regex = new RegExp(`\\b${pattern.from}\\b`, 'i');
    
    if (regex.test(text)) {
      return text.replace(regex, pattern.to);
    }

    return text;
  }

  /**
   * Randomly lowercase the message (casual texting style)
   * @param {string} text - Original text
   * @returns {string} - Potentially lowercased text
   */
  static randomLowercase(text) {
    if (Math.random() < config.LOWERCASE_PROBABILITY) {
      // Lowercase everything except I
      return text.replace(/\b([A-Z])\b/g, (match) => {
        return match === 'I' ? match : match.toLowerCase();
      }).replace(/^[A-Z]/, (match) => match.toLowerCase());
    }
    return text;
  }

  /**
   * Make response shorter occasionally (realistic casual chat)
   * @param {string} text - Original text
   * @returns {string} - Potentially shortened text
   */
  static maybeShorten(text) {
    if (Math.random() < config.SHORT_RESPONSE_PROBABILITY) {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim());
      if (sentences.length > 1) {
        // Return just first sentence
        return sentences[0].trim();
      }
    }
    return text;
  }

  /**
   * Calculate realistic response delay
   * Simulates "typing time"
   * @param {string} message - Message being responded to
   * @returns {number} - Delay in milliseconds
   */
  static calculateResponseDelay(message = '') {
    const baseDelay = config.AI_RESPONSE_DELAY_MIN;
    const maxDelay = config.AI_RESPONSE_DELAY_MAX;
    
    // Longer messages = slightly longer delay
    const messageLength = message.length;
    const lengthFactor = Math.min(messageLength / 100, 1); // Max 1
    
    const delay = baseDelay + ((maxDelay - baseDelay) * lengthFactor * Math.random());
    
    return Math.floor(delay);
  }

  /**
   * Determine if AI should ignore this message (realistic)
   * @returns {boolean} - True if should ignore
   */
  static shouldIgnoreMessage() {
    return Math.random() < config.IGNORE_PROBABILITY;
  }

  /**
   * Apply all humanization to a message
   * @param {string} text - Original AI response
   * @returns {string} - Humanized response
   */
  static humanize(text) {
    let humanized = text;
    
    // Apply transformations
    humanized = this.maybeShorten(humanized);
    humanized = this.randomLowercase(humanized);
    humanized = this.addTypos(humanized);
    
    return humanized;
  }

  /**
   * Select how AI should exit the conversation
   * @returns {Object} - {type: string, message: string|null}
   */
  static selectExitStrategy() {
    const strategies = config.EXIT_STRATEGIES;
    const total = Object.values(strategies).reduce((sum, weight) => sum + weight, 0);
    
    let random = Math.random() * total;
    
    if (random < strategies.GHOST) {
      return { type: 'GHOST', message: null };
    }
    
    random -= strategies.GHOST;
    if (random < strategies.BRB) {
      return { type: 'BRB', message: 'brb' };
    }
    
    random -= strategies.BRB;
    if (random < strategies.GTG) {
      const messages = ['gtg', 'gotta go', 'gotta run'];
      return { 
        type: 'GTG', 
        message: messages[Math.floor(Math.random() * messages.length)]
      };
    }
    
    // NATURAL exit
    const naturalMessages = config.NATURAL_EXIT_MESSAGES;
    return {
      type: 'NATURAL',
      message: naturalMessages[Math.floor(Math.random() * naturalMessages.length)]
    };
  }
}

module.exports = HumanBehavior;
