// llm-provider.js

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
      const apiKey = await SecureStorageService.getApiKey();
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }
  
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
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
        const webllm = await import('@mlc-ai/web-llm');
        
        const initProgressCallback = (progress) => {
          console.log('WebLLM loading:', progress);
          // You could emit an event here to update the UI
          if (this.config.onProgress) {
            this.config.onProgress(progress);
          }
        };
        
        this.engine = await webllm.CreateMLCEngine(
          this.config.model || "Llama-3.1-8B-Instruct-q4f32_1-MLC",
          { 
            initProgressCallback,
            wasmUrl: this.config.wasmUrl || '/models/llama-3.wasm'
          }
        );
        
        this.modelLoaded = true;
        return true;
      } catch (error) {
        console.error('WebLLM initialization error:', error);
        throw new Error(`Failed to initialize WebLLM: ${error.message}`);
      }
    }
    
    async generateResponse(messages) {
      if (!this.modelLoaded || !this.engine) {
        throw new Error('WebLLM not initialized');
      }
  
      try {
        const response = await this.engine.chat.completions.create({
          messages,
          temperature: this.config.temperature || 0.7,
          stream: false
        });
        
        return response;
      } catch (error) {
        console.error('WebLLM generation error:', error);
        throw new Error(`WebLLM generation failed: ${error.message}`);
      }
    }
    
    async cleanup() {
      if (this.engine) {
        // Any cleanup needed for WebLLM
        this.modelLoaded = false;
        this.engine = null;
      }
    }
  
    async isModelDownloaded(modelId) {
      try {
        const webllm = await import('@mlc-ai/web-llm');
        return await webllm.checkModelDownloaded(modelId);
      } catch (error) {
        console.error('Error checking model status:', error);
        return false;
      }
    }
  }
  
  export { LLMProvider, OpenAIProvider, WebLLMProvider };