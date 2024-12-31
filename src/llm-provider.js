// src/llm-provider.js

class LLMProvider {
  constructor(config = {}) {
    this.config = config;
  }
  
  async initialize() {
    throw new Error('Not implemented');
  }
  
  async generateResponse(messages) {
    throw new Error('Not implemented');
  }
  
  async cleanup() {
    // Optional cleanup method
  }
}

class OpenAIProvider extends LLMProvider {
  constructor(config) {
    super(config);
  }
  
  async initialize() {
    // No initialization needed for OpenAI
    return true;
  }
  
  async generateResponse(messages) {
    const apiKey = await chrome.storage.local.get('openai_api_key');
    if (!apiKey.openai_api_key) {
      throw new Error('OpenAI API key not found');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.openai_api_key}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        temperature: this.config.temperature || 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    return data;
  }
}

class WebLLMProvider extends LLMProvider {
  constructor(config) {
    super(config);
    this.engine = null;
    this.modelLoaded = false;
  }
  
  async initialize() {
    try {
      if (this.modelLoaded && this.engine) {
        return true;
      }

      throw new Error('WebLLM is not yet implemented');
      
      // Commented out WebLLM initialization for now
      /*
      const webllm = await import('@mlc-ai/web-llm');
      
      const initProgressCallback = (progress) => {
        console.log('WebLLM loading:', progress);
        if (this.config.onProgress) {
          this.config.onProgress(progress);
        }
      };
      
      this.engine = await webllm.CreateMLCEngine({
        model: this.config.model || "Llama-3.1-8B-Instruct-q4f32_1-MLC",
        config: { 
          initProgressCallback,
          wasmUrl: this.config.wasmUrl || '/models/llama-3.wasm'
        }
      });
      
      this.modelLoaded = true;
      return true;
      */
    } catch (error) {
      console.error('WebLLM initialization error:', error);
      throw new Error(`WebLLM is not available yet: ${error.message}`);
    }
  }
  
  async generateResponse(messages) {
    throw new Error('WebLLM is not yet implemented');
  }
  
  async cleanup() {
    this.modelLoaded = false;
    this.engine = null;
  }
}

export function createProvider(type, config = {}) {
  switch (type.toLowerCase()) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'webllm':
      return new WebLLMProvider(config);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

export { LLMProvider, OpenAIProvider, WebLLMProvider };