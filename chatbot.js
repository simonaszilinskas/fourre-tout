async function getEmbedding(text) {
  try {
    // Get API key from storage
    const result = await chrome.storage.local.get('openai_api_key');
    const API_KEY = result.openai_api_key;
    
    if (!API_KEY) {
      throw new Error('OpenAI API key not found. Please set it in the extension settings.');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-ada-002"
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate embedding');
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

class Chatbot {
  constructor() {
    this.vectors = [];
    this.loadVectors();
  }
  
  async loadVectors() {
    const result = await chrome.storage.local.get('vectors');
    this.vectors = result.vectors || [];
  }
  
  async findRelevantKnowledge(query) {
    try {
      const queryEmbedding = await getEmbedding(query);
      
      // Calculate cosine similarity with stored vectors
      const similarities = this.vectors.map(vector => ({
        text: vector.text,
        similarity: this.cosineSimilarity(queryEmbedding, vector.embedding)
      }));
      
      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3)
        .map(item => item.text);
    } catch (error) {
      console.error('Error finding relevant knowledge:', error);
      return [];
    }
  }
  
  cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
  
  async generateResponse(query) {
    try {
      const relevantKnowledge = await this.findRelevantKnowledge(query);
      
      // Get API key from storage
      const result = await chrome.storage.local.get('openai_api_key');
      const API_KEY = result.openai_api_key;
      
      if (!API_KEY) {
        return {
          response: "Please set your OpenAI API key in the extension settings.",
          sources: []
        };
      }

      // Use OpenAI API to generate response
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant. Use the provided context to answer questions accurately and concisely."
            },
            {
              role: "user",
              content: `Context: ${relevantKnowledge.join('\n\n')}\n\nQuery: ${query}`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate response');
      }

      const data = await response.json();
      return {
        response: data.choices[0].message.content,
        sources: relevantKnowledge
      };
    } catch (error) {
      console.error('Error generating response:', error);
      return {
        response: "Sorry, there was an error generating the response. Please try again.",
        sources: []
      };
    }
  }
}