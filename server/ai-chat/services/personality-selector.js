/**
 * Personality Selector
 * Loads and selects AI personalities
 */

const fs = require('fs');
const path = require('path');
const personalitiesConfig = require('../config/personalities');

class PersonalitySelector {
  constructor() {
    this.personalities = [];
    this.loadPersonalities();
  }

  /**
   * Load all personality prompts from files
   */
  loadPersonalities() {
    this.personalities = personalitiesConfig.map(config => {
      const promptPath = path.join(__dirname, '../personalities', config.promptFile);
      
      try {
        const prompt = fs.readFileSync(promptPath, 'utf8');
        return {
          ...config,
          prompt: prompt
        };
      } catch (error) {
        console.error(`Failed to load personality ${config.id}:`, error.message);
        return null;
      }
    }).filter(p => p !== null);

    console.log(`✓ Loaded ${this.personalities.length} AI personalities`);
  }

  /**
   * Select random personality based on weights
   * @returns {Object} - Selected personality with prompt
   */
  selectRandomPersonality() {
    if (this.personalities.length === 0) {
      throw new Error('No personalities loaded');
    }

    // Calculate total weight
    const totalWeight = this.personalities.reduce((sum, p) => sum + p.weight, 0);
    
    // Random selection based on weights
    let random = Math.random() * totalWeight;
    
    for (const personality of this.personalities) {
      random -= personality.weight;
      if (random <= 0) {
        return personality;
      }
    }

    // Fallback to first personality
    return this.personalities[0];
  }

  /**
   * Get personality by ID
   * @param {string} id - Personality ID
   * @returns {Object|null} - Personality or null
   */
  getPersonalityById(id) {
    return this.personalities.find(p => p.id === id) || null;
  }

  /**
   * Get all personalities
   * @returns {Array} - All loaded personalities
   */
  getAllPersonalities() {
    return this.personalities;
  }
}

module.exports = PersonalitySelector;
