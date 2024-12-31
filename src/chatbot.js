// src/chatbot.js
import { OpenAIProvider, WebLLMProvider } from './llm-provider.js';
import SecureStorageService from './secure-storage.js';
import KnowledgeService from './knowledge-service.js';

class Chatbot {
  constructor(config = {}) {
    this.provider = null;
    this.config = {
      maxRetries: 3,
      baseRetryDelay: 1000,
      maxRetryDelay: 10000,
      timeout: 30000,
      ...config
    };

    this.conversationHistory = [];
    this.isInitialized = false;
  }

  // Initialize chatbot with specified provider
  async initialize(providerType = 'openai', providerConfig = {}) {
    try {
      // Cleanup existing provider if any
      if (this.provider) {
        await this.provider.cleanup();
      }

      // Create new provider
      switch (providerType.toLowerCase()) {
        case 'openai':
          this.provider = new OpenAIProvider(providerConfig);
          break;
        case 'webllm':
          this.provider = new WebLLMProvider(providerConfig);
          break;
        default:
          throw new Error(`Unknown provider type: ${providerType}`);
      }

      // Initialize with timeout
      await this.withTimeout(
        this.provider.initialize(),
        this.config.timeout,
        'Provider initialization timed out'
      );

      this.isInitialized = true;
      console.log('Chatbot initialized successfully');
    } catch (error) {
      console.error('Chatbot initialization error:', error);
      this.isInitialized = false;
      throw this.handleError(error);
    }
  }

  // Generate response with retries and error handling
  async generateResponse(query) {
    if (!this.isInitialized) {
      throw new Error('Chatbot not initialized');
    }

    try {
      // Find relevant knowledge with retries
      const relevantKnowledge = await this.withRetry(
        () => KnowledgeService.searchKnowledge(query)
      );

      // Prepare conversation context
      const messages = this.prepareMessages(query, relevantKnowledge);

      // Generate response with retries and timeout
      const response = await this.withRetry(async () => {
        return await this.withTimeout(
          this.provider.generateResponse(messages),
          this.config.timeout,
          'Response generation timed out'
        );
      });

      // Update conversation history
      this.updateConversationHistory(query, response, relevantKnowledge);

      return {
        response: response.choices[0].message.content,
        sources: relevantKnowledge.map(k => ({
          text: k.text.substring(0, 100) + '...',
          url: k.url,
          title: k.title
        }))
      };
    } catch (error) {
      console.error('Error in generateResponse:', error);
      throw this.handleError(error);
    }
  }

  // Prepare messages with context and history
  prepareMessages(query, relevantKnowledge) {
    const systemMessage = {
      role: "system",
      content: "You are a helpful AI assistant. Use the provided context to answer questions accurately and concisely. If the context doesn't contain relevant information, say so."
    };

    const contextMessage = {
      role: "user",
      content: `Context:\n${relevantKnowledge.map(k => `Source (${k.title}): ${k.text}`).join('\n\n')}\n\nQuestion: ${query}`
    };

    return [
      systemMessage,
      ...this.getRecentHistory(),
      contextMessage
    ];
  }

  getRecentHistory(limit = 5) {
    return this.conversationHistory
      .slice(-limit * 2)
      .map(({ role, content }) => ({ role, content }));
  }

  updateConversationHistory(query, response, knowledgeUsed) {
    this.conversationHistory.push(
      { role: 'user', content: query },
      { 
        role: 'assistant',
        content: response.choices[0].message.content,
        knowledge: knowledgeUsed
      }
    );

    if (this.conversationHistory.length > 100) {
      this.conversationHistory = this.conversationHistory.slice(-100);
    }
  }

  async withTimeout(promise, timeoutMs, message) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  async withRetry(operation) {
    let lastError;
    let delay = this.config.baseRetryDelay;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!this.isRetryableError(error) || attempt === this.config.maxRetries) {
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(
          delay * 2 * (0.5 + Math.random()),
          this.config.maxRetryDelay
        );
      }
    }

    throw lastError;
  }

  isRetryableError(error) {
    const retryableErrors = [
      'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'NETWORK_ERROR', 'Rate limit', '429', '503', '504'
    ];

    return retryableErrors.some(e =>
      error.message?.includes(e) || error.code?.includes(e)
    );
  }

  handleError(error) {
    const errorMessages = {
      'Failed to fetch': 'Network error. Please check your internet connection.',
      'API key not found': 'Please set your OpenAI API key.',
      'Unauthorized': 'Invalid API key. Check your settings.',
      'Rate limit': 'Too many requests. Try again later.',
      'timed out': 'Operation timed out. Please retry.'
    };

    const message = Object.entries(errorMessages).find(
      ([key]) => error.message?.includes(key)
    )?.[1] || 'An unexpected error occurred.';

    return new Error(message);
  }
}

export default Chatbot;
