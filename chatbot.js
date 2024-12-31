// chatbot.js
import KnowledgeService from './knowledge-service.js';
import SecureStorageService from './secure-storage.js';

class Chatbot {
  constructor() {
    this.retryCount = 3;
    this.retryDelay = 1000; // 1 second
  }
  
  async generateResponse(query) {
    try {
      // Find relevant knowledge with retries
      const relevantKnowledge = await this.withRetry(
        () => KnowledgeService.searchKnowledge(query)
      );
      
      // Get API key
      const apiKey = await SecureStorageService.getApiKey();
      if (!apiKey) {
        throw new Error('Please set your OpenAI API key in the extension settings.');
      }

      // Generate response with retries
      const response = await this.withRetry(
        () => this.callOpenAI(query, relevantKnowledge, apiKey)
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
  
  async callOpenAI(query, relevantKnowledge, apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. Use the provided context to answer questions accurately and concisely. If the context doesn't contain relevant information, say so."
          },
          {
            role: "user",
            content: `Context:\n${relevantKnowledge.map(k => 
              `Source (${k.title}): ${k.text}`
            ).join('\n\n')}\n\nQuestion: ${query}`
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    return await response.json();
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
      'Rate limit': 'Too many requests. Please try again in a moment.'
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