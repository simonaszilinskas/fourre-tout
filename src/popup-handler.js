// src/popup-handler.js
import Chatbot from './chatbot.js';
import SecureStorageService from './secure-storage.js';

let chatbot = null;
const MODEL_SIZES = {
  'Llama-3.1-8B-Instruct-q4f32_1-MLC': '4.2 GB',
  'Mistral-7B-Instruct-v0.2-q4f32_1': '3.8 GB',
  'Phi-2-3B-q4f32_1': '1.6 GB'
};

console.log('Popup handler script loading...');

// Initialize all UI elements and state
async function initializeUI() {
  console.log('Initializing UI elements');
  try {
    // Check for required elements first
    const requiredElements = [
      'chatInput',
      'sendMessage',
      'chatMessages',
      'providerSelect',
      'apiKey',
      'saveApiKey'
    ];

    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
      throw new Error(`Missing required elements: ${missingElements.join(', ')}`);
    }

    // Initialize buttons and inputs
    initializeButtons();
    
    // Initialize provider selection
    initializeProviderSelection();
    
    // Load saved API key
    await loadSavedApiKey();
    
    // Initialize chatbot
    await initializeChatbot();
    
    // Update initial UI state
    updateUIState();
    
    console.log('UI initialization complete');
  } catch (error) {
    console.error('Error during UI initialization:', error);
    showError('Initialization failed: ' + error.message);
  }
}

function initializeButtons() {
  console.log('Initializing buttons');
  
  // Send message button
  const sendButton = document.getElementById('sendMessage');
  const chatInput = document.getElementById('chatInput');

  if (sendButton && chatInput) {
    console.log('Adding send message listeners');
    sendButton.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }

  // API key button
  const saveApiKeyButton = document.getElementById('saveApiKey');
  if (saveApiKeyButton) {
    console.log('Adding save API key listener');
    saveApiKeyButton.addEventListener('click', handleSaveApiKey);
  }

  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      console.log('Tab clicked:', tab.dataset.tab);
      switchTab(tab.dataset.tab);
    });
  });

  // Download model button
  const downloadButton = document.getElementById('downloadModel');
  if (downloadButton) {
    downloadButton.addEventListener('click', handleModelDownload);
  }
}

function initializeProviderSelection() {
  console.log('Initializing provider selection');
  const providerSelect = document.getElementById('providerSelect');
  if (providerSelect) {
    providerSelect.addEventListener('change', handleProviderChange);
    updateProviderSettings(providerSelect.value);
  }

  const modelSelect = document.getElementById('modelSelect');
  if (modelSelect) {
    modelSelect.addEventListener('change', updateModelSize);
  }
}

async function loadSavedApiKey() {
  console.log('Loading saved API key');
  try {
    const apiKey = await SecureStorageService.getApiKey();
    if (apiKey) {
      const apiKeyInput = document.getElementById('apiKey');
      if (apiKeyInput) {
        apiKeyInput.value = apiKey;
        console.log('API key loaded successfully');
      }
    }
  } catch (error) {
    console.error('Error loading API key:', error);
  }
}

async function initializeChatbot() {
  console.log('Initializing chatbot');
  try {
    chatbot = new Chatbot();
    const provider = document.getElementById('providerSelect')?.value || 'openai';
    await chatbot.initialize(provider);
    console.log('Chatbot initialized successfully');
  } catch (error) {
    console.error('Error initializing chatbot:', error);
    throw error;
  }
}

// Event Handlers
async function handleSendMessage() {
  console.log('Handling send message');
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  
  if (!message) return;

  try {
    setInputState(false);
    
    // Add user message
    addMessage(message, 'user-message');
    chatInput.value = '';

    // Get chatbot response
    const response = await chatbot.generateResponse(message);
    addMessage(response.response, 'bot-message');

    if (response.sources?.length > 0) {
      addSourcesMessage(response.sources);
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showError('Failed to get response: ' + error.message);
  } finally {
    setInputState(true);
  }
}

async function handleSaveApiKey() {
  console.log('Handling save API key');
  const apiKeyInput = document.getElementById('apiKey');
  const apiKey = apiKeyInput.value.trim();
  
  if (!apiKey) {
    showError('Please enter an API key');
    return;
  }

  try {
    await SecureStorageService.storeApiKey(apiKey);
    showSuccess('API key saved successfully');
    
    // Reinitialize chatbot with new key
    await initializeChatbot();
  } catch (error) {
    console.error('Error saving API key:', error);
    showError('Failed to save API key: ' + error.message);
  }
}

async function handleProviderChange(event) {
  console.log('Handling provider change:', event.target.value);
  const provider = event.target.value;
  
  updateProviderSettings(provider);
  
  try {
    await initializeChatbot();
  } catch (error) {
    console.error('Error changing provider:', error);
    showError('Failed to change provider: ' + error.message);
  }
}

async function handleModelDownload() {
  console.log('Handling model download');
  const downloadButton = document.getElementById('downloadModel');
  const progressBar = document.getElementById('progressBar');
  const modelStatus = document.getElementById('modelStatus');

  try {
    downloadButton.disabled = true;
    progressBar.style.display = 'block';
    modelStatus.textContent = 'Starting download...';

    await initializeChatbot();

    modelStatus.textContent = 'Model ready to use';
    downloadButton.textContent = 'Downloaded';
    downloadButton.classList.add('downloaded');
  } catch (error) {
    console.error('Error downloading model:', error);
    modelStatus.textContent = 'Download failed: ' + error.message;
    downloadButton.disabled = false;
  }
}

// UI Updates
function updateProviderSettings(provider) {
  console.log('Updating provider settings for:', provider);
  const openaiSettings = document.getElementById('openaiSettings');
  const webllmSettings = document.getElementById('webllmSettings');
  
  if (openaiSettings) {
    openaiSettings.style.display = provider === 'openai' ? 'block' : 'none';
  }
  if (webllmSettings) {
    webllmSettings.style.display = provider === 'webllm' ? 'block' : 'none';
  }
}

function updateModelSize() {
  console.log('Updating model size display');
  const modelSelect = document.getElementById('modelSelect');
  const modelSizeSpan = document.getElementById('modelSize');
  
  if (modelSelect && modelSizeSpan) {
    const selectedModel = modelSelect.value;
    modelSizeSpan.textContent = `Size: ${MODEL_SIZES[selectedModel] || 'Unknown'}`;
  }
}

function switchTab(tabId) {
  console.log('Switching to tab:', tabId);
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  const selectedTab = document.querySelector(`[data-tab="${tabId}"]`);
  const selectedContent = document.getElementById(`${tabId}Tab`);
  
  if (selectedTab && selectedContent) {
    selectedTab.classList.add('active');
    selectedContent.classList.add('active');
  }
}

function updateUIState() {
  console.log('Updating UI state');
  updateModelSize();
  // Add any other UI state updates here
}

// Helper Functions
function addMessage(content, className) {
  console.log('Adding message:', { type: className });
  const chatMessages = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${className}`;
  messageDiv.innerHTML = content;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSourcesMessage(sources) {
  const sourcesHtml = sources.map(source => `
    <div class="source">
      <div class="source-text">${source.text}</div>
      <a href="${source.url}" target="_blank">${source.title}</a>
    </div>
  `).join('');

  addMessage(`
    <div class="sources-container">
      <div class="sources-title">Sources:</div>
      ${sourcesHtml}
    </div>
  `, 'sources-message');
}

function showError(message) {
  console.error('Error:', message);
  addMessage(`Error: ${message}`, 'error-message');
}

function showSuccess(message) {
  console.log('Success:', message);
  addMessage(message, 'success-message');
}

function setInputState(enabled) {
  const chatInput = document.getElementById('chatInput');
  const sendButton = document.getElementById('sendMessage');
  
  if (chatInput) chatInput.disabled = !enabled;
  if (sendButton) {
    sendButton.disabled = !enabled;
    sendButton.textContent = enabled ? 'Send' : 'Sending...';
  }
}

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded in popup handler');
  initializeUI().catch(error => {
    console.error('Error during initialization:', error);
    showError('Failed to initialize: ' + error.message);
  });
});

// Export for webpack
export default {};