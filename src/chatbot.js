// src/chatbot.js
import { OpenAIProvider, WebLLMProvider } from './llm-provider.js';
import SecureStorageService from './secure-storage.js';
import KnowledgeService from './knowledge-service.js';

class Chatbot {
  constructor() {
    this.provider = null;
    this.retryCount = 3;
    this.retryDelay = 1000;
  }
  
  async initialize(providerType = 'openai', config = {}) {
    try {
      // Cleanup existing provider if any
      if (this.provider) {
        await this.provider.cleanup();
      }
      
      // Create new provider
      switch (providerType.toLowerCase()) {
        case 'openai':
          this.provider = new OpenAIProvider(config);
          break;
        case 'webllm':
          this.provider = new WebLLMProvider(config);
          break;
        default:
          throw new Error(`Unknown provider type: ${providerType}`);
      }
      
      // Initialize the provider
      await this.provider.initialize();
      
    } catch (error) {
      console.error('Chatbot initialization error:', error);
      throw this.handleError(error);
    }
  }
  
  async generateResponse(query) {
    try {
      if (!this.provider) {
        throw new Error('Chatbot not initialized');
      }

      // Find relevant knowledge with retries
      const relevantKnowledge = await this.withRetry(
        () => KnowledgeService.searchKnowledge(query)
      );
      
      // Prepare messages
      const messages = [
        { 
          role: "system", 
          content: "You are a helpful AI assistant. Use the provided context to answer questions accurately and concisely. If the context doesn't contain relevant information, say so." 
        },
        {
          role: "user",
          content: `Context:\n${relevantKnowledge.map(k => 
            `Source (${k.title}): ${k.text}`
          ).join('\n\n')}\n\nQuestion: ${query}`
        }
      ];

      // Generate response with retries
      const response = await this.withRetry(
        () => this.provider.generateResponse(messages)
      );

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
  
  async withRetry(operation) {
    let lastError;
    
    for (let i = 0; i < this.retryCount; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (i < this.retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          this.retryDelay *= 2; // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }
  
  handleError(error) {
    // Map error types to user-friendly messages
    const errorMessages = {
      'Failed to fetch': 'Network error. Please check your internet connection.',
      'API key not found': 'Please set your OpenAI API key in the extension settings.',
      'Unauthorized': 'Invalid API key. Please check your settings.',
      'insufficient_quota': 'OpenAI API quota exceeded. Please check your billing.',
      'Rate limit': 'Too many requests. Please try again in a moment.',
      'WebLLM not initialized': 'Local model not loaded. Please wait for initialization to complete.',
      'Failed to initialize WebLLM': 'Failed to load local model. Please check your browser supports WebGPU.'
    };

    // Find matching error message or use generic one
    const message = Object.entries(errorMessages).find(
      ([key]) => error.message.includes(key)
    )?.[1] || 'An unexpected error occurred. Please try again.';

    // Report error to background script for notification
    chrome.runtime.sendMessage({
      type: "report_error",
      error: message
    }).catch(() => {
      // Ignore error if background script isn't ready
    });

    return new Error(message);
  }
}

export default Chatbot;