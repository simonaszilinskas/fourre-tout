// popup-handler.js
import Chatbot from './chatbot.js';
import SecureStorageService from './secure-storage.js';

// Initialize chatbot
const chatbot = new Chatbot();

async function refreshKnowledgeList() {
  const knowledgeList = document.getElementById('knowledgeList');
  try {
    const result = await chrome.storage.local.get('vectors');
    const vectors = result.vectors || [];
    
    knowledgeList.innerHTML = ''; // Clear existing items
    
    if (vectors.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'knowledge-empty';
      emptyMessage.textContent = 'No knowledge stored yet. Highlight text on any webpage and use the right-click menu to add it.';
      knowledgeList.appendChild(emptyMessage);
      return;
    }
    
    // Sort vectors by timestamp (newest first)
    vectors
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach((vector, index) => {
        const item = document.createElement('div');
        item.className = 'knowledge-item';
        
        const text = document.createElement('div');
        text.className = 'knowledge-text';
        text.textContent = vector.text;
        
        const metadata = document.createElement('div');
        metadata.className = 'knowledge-metadata';
        
        const timestamp = document.createElement('div');
        timestamp.className = 'knowledge-timestamp';
        timestamp.textContent = new Date(vector.timestamp).toLocaleString();
        
        const source = document.createElement('div');
        source.className = 'knowledge-source';
        if (vector.url) {
          const link = document.createElement('a');
          link.href = vector.url;
          link.target = '_blank';
          link.textContent = vector.title || vector.url;
          source.appendChild(link);
        }
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'knowledge-delete';
        deleteButton.innerHTML = '×';
        deleteButton.title = 'Delete';
        deleteButton.addEventListener('click', async () => {
          // Remove from storage
          vectors.splice(index, 1);
          await chrome.storage.local.set({ vectors });
          
          // Refresh display
          refreshKnowledgeList();
          
          // Show notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Knowledge Removed',
            message: 'Item removed from knowledge base'
          });
        });
        
        metadata.appendChild(timestamp);
        metadata.appendChild(source);
        item.appendChild(text);
        item.appendChild(metadata);
        item.appendChild(deleteButton);
        knowledgeList.appendChild(item);
      });
  } catch (error) {
    console.error('Error refreshing knowledge list:', error);
    knowledgeList.innerHTML = '<div class="error-message">Error loading knowledge list: ' + error.message + '</div>';
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "knowledge_updated") {
    refreshKnowledgeList();
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  // Initial load of knowledge list
  await refreshKnowledgeList();
  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab') + 'Tab';
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Settings functionality
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');

  // Load existing API key
  try {
    const apiKey = await SecureStorageService.getApiKey();
    if (apiKey) {
      apiKeyInput.value = apiKey;
    }
  } catch (error) {
    console.error('Error loading API key:', error);
  }

  // Save API key
  saveApiKeyButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      try {
        await SecureStorageService.storeApiKey(apiKey);
        addMessage('API key saved successfully!', 'bot-message');
      } catch (error) {
        const errorMessage = error.message || 'Unknown error occurred while saving the API key';
        console.error('Detailed error:', error);
        addMessage('Error saving API key: ' + errorMessage, 'error-message');
      }
    }
  });

  // Chat functionality
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendButton = document.getElementById('sendMessage');

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessage(message, 'user-message');
    chatInput.value = '';

    try {
      // Get chatbot response
      const response = await chatbot.generateResponse(message);
      
      // Add bot response to chat
      let botMessageHTML = response.response;
      if (response.sources && response.sources.length > 0) {
        botMessageHTML += '<div class="sources">Sources:<br>' + 
          response.sources.map(source => 
            `<a href="${source.url}" target="_blank">${source.title}</a>: ${source.text}`
          ).join('<br>') + 
        '</div>';
      }
      addMessage(botMessageHTML, 'bot-message');
    } catch (error) {
      addMessage('Error: ' + error.message, 'error-message');
    }
  }

  function addMessage(content, className) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${className}`;
    messageDiv.innerHTML = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Event listeners for sending messages
  sendButton.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});