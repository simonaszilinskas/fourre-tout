// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize chatbot
  const chatbot = new Chatbot();
  await chatbot.loadVectors();

  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      // Add active class to clicked tab and its content
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab') + 'Tab';
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Settings functionality
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');

  // Load existing API key
  chrome.storage.local.get('openai_api_key', (result) => {
    if (result.openai_api_key) {
      apiKeyInput.value = result.openai_api_key;
    }
  });

  // Save API key
  saveApiKeyButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      await chrome.storage.local.set({ openai_api_key: apiKey });
      addMessage('API key saved successfully!', 'bot-message');
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

    // Get chatbot response
    const response = await chatbot.generateResponse(message);
    
    // Add bot response to chat
    let botMessageHTML = response.response;
    if (response.sources && response.sources.length > 0) {
      botMessageHTML += '<div class="sources">Sources:<br>' + 
        response.sources.map(source => `- ${source}`).join('<br>') + 
      '</div>';
    }
    addMessage(botMessageHTML, 'bot-message');
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

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "knowledge_updated") {
      refreshKnowledgeList();
    }
  });

  async function refreshKnowledgeList() {
    const result = await chrome.storage.local.get('vectors');
    const vectors = result.vectors || [];
    
    const knowledgeList = document.getElementById('knowledgeList');
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
        
        const timestamp = document.createElement('div');
        timestamp.className = 'knowledge-timestamp';
        timestamp.textContent = new Date(vector.timestamp).toLocaleString();
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'knowledge-delete';
        deleteButton.innerHTML = '×';
        deleteButton.title = 'Delete';
        deleteButton.addEventListener('click', async () => {
          // Remove from storage
          const updatedVectors = vectors.filter((_, i) => i !== index);
          await chrome.storage.local.set({ vectors: updatedVectors });
          
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
        
        item.appendChild(text);
        item.appendChild(timestamp);
        item.appendChild(deleteButton);
        knowledgeList.appendChild(item);
      });
  }

  // Initial load of knowledge list
  refreshKnowledgeList();
});