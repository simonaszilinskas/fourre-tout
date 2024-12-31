// knowledge-service.js
import SecureStorageService from './secure-storage.js';

class KnowledgeService {
  static async storeKnowledge(text, url, title) {
    try {
      const apiKey = await SecureStorageService.getApiKey();
      if (!apiKey) {
        throw new Error('API key not found');
      }

      // Get embedding from OpenAI
      const embedding = await this.getEmbedding(text, apiKey);
      
      // Get existing vectors
      const result = await chrome.storage.local.get('vectors');
      const vectors = result.vectors || [];
      
      // Calculate current storage size
      const storageSize = await this.calculateStorageSize(vectors);
      
      // Check if we're approaching storage limits (80% of Chrome's limit)
      if (storageSize > 4000000) {  // 4MB threshold
        await this.cleanupOldVectors(vectors);
      }
      
      // Add new vector with metadata
      vectors.push({
        text,
        embedding,
        url,
        title,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0
      });
      
      // Store updated vectors
      await chrome.storage.local.set({ vectors });
      
      return true;
    } catch (error) {
      console.error('Error storing knowledge:', error);
      throw new Error(`Failed to store knowledge: ${error.message}`);
    }
  }
  
  static async getEmbedding(text, apiKey) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-ada-002"
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate embedding');
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
  
  static async calculateStorageSize(vectors) {
    return new Blob([JSON.stringify(vectors)]).size;
  }
  
  static async cleanupOldVectors(vectors) {
    // Sort by last accessed and access count
    vectors.sort((a, b) => {
      const accessScore = b.accessCount - a.accessCount;
      const timeScore = b.lastAccessed - a.lastAccessed;
      return (accessScore * 0.7) + (timeScore * 0.3);
    });
    
    // Keep only the most relevant 75% of vectors
    vectors.length = Math.floor(vectors.length * 0.75);
  }
  
  static async searchKnowledge(query) {
    try {
      const apiKey = await SecureStorageService.getApiKey();
      if (!apiKey) {
        throw new Error('API key not found');
      }

      const queryEmbedding = await this.getEmbedding(query, apiKey);
      const result = await chrome.storage.local.get('vectors');
      const vectors = result.vectors || [];
      
      // Calculate similarities and update access metrics
      const similarities = vectors.map(vector => {
        vector.lastAccessed = Date.now();
        vector.accessCount += 1;
        return {
          text: vector.text,
          url: vector.url,
          title: vector.title,
          similarity: this.cosineSimilarity(queryEmbedding, vector.embedding)
        };
      });
      
      // Update vectors with new access metrics
      await chrome.storage.local.set({ vectors });
      
      // Return top results with source information
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);
    } catch (error) {
      console.error('Error searching knowledge:', error);
      throw new Error(`Failed to search knowledge: ${error.message}`);
    }
  }
  
  static cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export default KnowledgeService;