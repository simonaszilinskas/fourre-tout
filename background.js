// background.js
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "addToKnowledge",
      title: "Add to chatbot's knowledge",
      contexts: ["selection"]
    });
  });
  
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "addToKnowledge") {
      const selectedText = info.selectionText;
      processText(selectedText);
    }
  });
  
  async function processText(text) {
    try {
      // Get API key from storage
      const result = await chrome.storage.local.get('openai_api_key');
      const apiKey = result.openai_api_key;
      
      if (!apiKey) {
        throw new Error('OpenAI API key not found. Please set it in the extension settings.');
      }
  
      // Convert text to vector embedding using a transformer model
      const embedding = await getEmbedding(text, apiKey);
      
      // Store in local vector database
      await storeVector(text, embedding);
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Knowledge Base Updated',
        message: 'Text successfully added to knowledge base'
      });
  
      // Notify any open popups
      chrome.runtime.sendMessage({
        type: "knowledge_updated",
        text: text
      }).catch(() => {
        // Ignore error if no listeners
      });
      
    } catch (error) {
      console.error("Error processing text:", error);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Error',
        message: error.message
      });
    }
  }
  
  async function getEmbedding(text, apiKey) {
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
  
  async function storeVector(text, embedding) {
    // Get existing vectors from storage
    const result = await chrome.storage.local.get('vectors');
    const vectors = result.vectors || [];
    
    // Add new vector
    vectors.push({
      text,
      embedding,
      timestamp: Date.now()
    });
    
    // Store updated vectors
    await chrome.storage.local.set({ vectors });
  }
  