/**
 * OpenAI API Client
 * Handles all communication with OpenAI API
 */

const https = require('https');
const config = require('../config/settings');

class OpenAIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'api.openai.com';
  }

  /**
   * Send a message to OpenAI and get response
   * @param {Array} messages - Array of message objects [{role: 'user'/'assistant'/'system', content: '...'}]
   * @param {boolean} jsonMode - Use JSON response format
   * @returns {Promise<string|Object>} - AI response or parsed JSON
   */
  async getChatCompletion(messages, jsonMode = false) {
    const requestBody = {
      model: config.OPENAI_MODEL,
      messages: messages,
      temperature: config.OPENAI_TEMPERATURE,
      max_tokens: config.OPENAI_MAX_TOKENS,
      top_p: config.OPENAI_TOP_P,
      frequency_penalty: config.OPENAI_FREQUENCY_PENALTY,
      presence_penalty: config.OPENAI_PRESENCE_PENALTY,
    };

    // Enable JSON mode if requested
    if (jsonMode) {
      requestBody.response_format = { type: "json_object" };
    }

    const data = JSON.stringify(requestBody);

    const options = {
      hostname: this.baseURL,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: config.API_TIMEOUT
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            
            if (res.statusCode !== 200) {
              reject(new Error(`OpenAI API error: ${parsed.error?.message || 'Unknown error'}`));
              return;
            }

            const response = parsed.choices?.[0]?.message?.content;
            if (!response) {
              reject(new Error('No response from OpenAI'));
              return;
            }

            // If JSON mode, parse and return object
            if (jsonMode) {
              try {
                const jsonResponse = JSON.parse(response.trim());
                resolve(jsonResponse);
              } catch (error) {
                reject(new Error(`Failed to parse JSON response: ${error.message}`));
              }
            } else {
              resolve(response.trim());
            }

          } catch (error) {
            reject(new Error(`Failed to parse OpenAI response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`OpenAI request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OpenAI request timed out'));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Get response with retry logic
   * @param {Array} messages - Message history
   * @param {boolean} jsonMode - Use JSON response format
   * @param {number} retries - Number of retries left
   * @returns {Promise<string|Object>} - AI response or parsed JSON
   */
  async getChatCompletionWithRetry(messages, jsonMode = false, retries = config.MAX_RETRIES) {
    try {
      return await this.getChatCompletion(messages, jsonMode);
    } catch (error) {
      if (retries > 0) {
        console.log(`OpenAI request failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        return this.getChatCompletionWithRetry(messages, jsonMode, retries - 1);
      }
      throw error;
    }
  }
}

module.exports = OpenAIClient;
