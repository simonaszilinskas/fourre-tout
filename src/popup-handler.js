// src/popup-handler.js
import Chatbot from './chatbot.js';
import SecureStorageService from './secure-storage.js';

console.log('Popup handler loading...');

let chatbot = null;
const MODEL_SIZES = {
  'Llama-3.1-8B-Instruct-q4f32_1-MLC': '4.2 GB',
  'Mistral-7B-Instruct-v0.2-q4f32_1': '3.8 GB',
  'Phi-2-3B-q4f32_1': '1.6 GB'
};

function initializeEventListeners() {
  console.log('Initializing event listeners...');
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      console.log('Tab clicked:', e.target.dataset.tab);
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      e.target.classList.add('active');
      const tabId = e.target.dataset.tab + 'Tab';
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Chat input
  const chatInput = document.getElementById('chatInput');
  const sendButton = document.getElementById('sendMessage');

  if (sendButton) {
    sendButton.addEventListener('click', () => {
      console.log('Send button clicked');
      sendMessage();
    });
  } else {
    console.error('Send button not found');
  }

  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        console.log('Enter pressed in chat input');
        e.preventDefault();
        sendMessage();
      }
    });
  } else {
    console.error('Chat input not found');
  }

  // Provider selection
  const providerSelect = document.getElementById('providerSelect');
  if (providerSelect) {
    providerSelect.addEventListener('change', async (e) => {
      console.log('Provider changed:', e.target.value);
      const provider = e.target.value;
      document.getElementById('openaiSettings').style.display = provider === 'openai' ? 'block' : 'none';
      document.getElementById('webllmSettings').style.display = provider === 'webllm' ? 'block' : 'none';
    });
  }

  // Model selection
  const modelSelect = document.getElementById('modelSelect');
  if (modelSelect) {
    modelSelect.addEventListener('change', (e) => {
      console.log('Model changed:', e.target.value);
      updateModelSize();
    });
  }

  // Download button
  const downloadButton = document.getElementById('downloadModel');
  if (downloadButton) {
    downloadButton.addEventListener('click', async () => {
      console.log('Download button clicked');
      try {
        await downloadModel();
      } catch (error) {
        console.error('Error downloading model:', error);
        showError('Failed to download model: ' + error.message);
      }
    });
  }

  // Save API key
  const saveApiKeyButton = document.getElementById('saveApiKey');
  if (saveApiKeyButton) {
    saveApiKeyButton.addEventListener('click', async () => {
      console.log('Save API key button clicked');
      await saveApiKey();
    });
  }
}

async function sendMessage() {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  
  if (!message) return;
  
  try {
    addMessage(message, 'user-message');
    chatInput.value = '';
    
    if (!chatbot) {
      chatbot = new Chatbot();
      await chatbot.initialize(document.getElementById('providerSelect').value);
    }

    const response = await chatbot.generateResponse(message);
    addMessage(response.response, 'bot-message');
  } catch (error) {
    console.error('Error sending message:', error);
    addMessage('Error: ' + error.message, 'error-message');
  }
}

function addMessage(content, className) {
  const chatMessages = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${className}`;
  messageDiv.innerHTML = content;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function saveApiKey() {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) return;

  try {
    await SecureStorageService.storeApiKey(apiKey);
    addMessage('API key saved successfully!', 'bot-message');
  } catch (error) {
    console.error('Error saving API key:', error);
    addMessage('Error saving API key: ' + error.message, 'error-message');
  }
}

function updateModelSize() {
  const modelSelect = document.getElementById('modelSelect');
  const modelSizeSpan = document.getElementById('modelSize');
  const selectedModel = modelSelect.value;
  modelSizeSpan.textContent = `Size: ${MODEL_SIZES[selectedModel]}`;
}

async function downloadModel() {
  const modelSelect = document.getElementById('modelSelect');
  const downloadButton = document.getElementById('downloadModel');
  const progressBar = document.getElementById('progressBar');
  const progressBarFill = document.getElementById('progressBarFill');
  const modelStatus = document.getElementById('modelStatus');

  try {
    downloadButton.disabled = true;
    progressBar.style.display = 'block';
    modelStatus.textContent = 'Starting download...';

    if (!chatbot) {
      chatbot = new Chatbot();
    }

    await chatbot.initialize('webllm', {
      model: modelSelect.value,
      onProgress: (progress) => {
        if (progress.type === 'download') {
          progressBarFill.style.width = `${progress.progress * 100}%`;
          modelStatus.textContent = `Downloading... ${Math.round(progress.progress * 100)}%`;
        }
      }
    });

    modelStatus.textContent = 'Model ready to use';
    downloadButton.textContent = 'Downloaded';
    downloadButton.classList.add('downloaded');
  } catch (error) {
    console.error('Error downloading model:', error);
    modelStatus.textContent = `Error: ${error.message}`;
    downloadButton.disabled = false;
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded');
  initializeEventListeners();
  updateModelSize();
});