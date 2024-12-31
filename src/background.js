// src/background.js
import KnowledgeService from './knowledge-service.js';
import SecureStorageService from './secure-storage.js';

// State management
const STATE = {
  isProcessing: false,
  lastError: null,
  pendingOperations: new Map(),
  connections: new Set()
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  try {
    // Create context menu
    await chrome.contextMenus.create({
      id: "addToKnowledge",
      title: "Add to chatbot's knowledge",
      contexts: ["selection"]
    });

    // Initialize services
    await KnowledgeService.initDB();
    
    console.log('Extension initialized successfully');
  } catch (error) {
    handleError('Extension initialization failed', error);
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "addToKnowledge") {
    const operationId = generateOperationId();
    
    try {
      STATE.isProcessing = true;
      STATE.pendingOperations.set(operationId, {
        type: 'add_knowledge',
        status: 'processing',
        timestamp: Date.now()
      });

      await processSelection(info.selectionText, tab.url, tab.title);
      
      STATE.pendingOperations.set(operationId, {
        type: 'add_knowledge',
        status: 'completed',
        timestamp: Date.now()
      });

      notifySuccess('Text successfully added to knowledge base');
    } catch (error) {
      STATE.pendingOperations.set(operationId, {
        type: 'add_knowledge',
        status: 'failed',
        error: error.message,
        timestamp: Date.now()
      });

      handleError('Failed to process selection', error);
    } finally {
      STATE.isProcessing = false;
      cleanupOldOperations();
    }
  }
});

// Process selected text
async function processSelection(text, url, title) {
  if (!text || !url || !title) {
    throw new Error('Invalid selection data');
  }

  try {
    // Validate API key first
    if (!await SecureStorageService.validateStoredKey()) {
      throw new Error('Please set up your API key in the extension settings');
    }

    // Process the selection
    await KnowledgeService.storeKnowledge(text, url, title);

    // Notify any open popups
    broadcastMessage({
      type: "knowledge_updated",
      data: { text, url, title }
    });

  } catch (error) {
    console.error("Error processing selection:", error);
    throw new Error(`Failed to process selection: ${error.message}`);
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(error => sendResponse({ error: error.message }));
  
  // Return true to indicate async response
  return true;
});

// Handle incoming messages
async function handleMessage(message, sender) {
  const handlers = {
    'report_error': handleErrorReport,
    'get_state': getState,
    'clear_error': clearError,
    'connect_popup': handlePopupConnection,
    'disconnect_popup': handlePopupDisconnection
  };

  const handler = handlers[message.type];
  if (!handler) {
    throw new Error(`Unknown message type: ${message.type}`);
  }

  return await handler(message, sender);
}

// Message handlers
async function handleErrorReport(message) {
  handleError(message.error);
  return { success: true };
}

async function getState() {
  return {
    isProcessing: STATE.isProcessing,
    lastError: STATE.lastError,
    pendingOperations: Array.from(STATE.pendingOperations.entries())
  };
}

async function clearError() {
  STATE.lastError = null;
  return { success: true };
}

async function handlePopupConnection(message, sender) {
  STATE.connections.add(sender.id);
  return { success: true };
}

async function handlePopupDisconnection(message, sender) {
  STATE.connections.delete(sender.id);
  return { success: true };
}

// Error handling
function handleError(context, error) {
  const errorMessage = error?.message || context;
  console.error(context, error);

  STATE.lastError = {
    message: errorMessage,
    timestamp: Date.now()
  };

  // Show notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'Error',
    message: errorMessage
  });

  // Notify connected popups
  broadcastMessage({
    type: "error_occurred",
    error: errorMessage
  });
}

// Success notification
function notifySuccess(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'Success',
    message: message
  });

  broadcastMessage({
    type: "operation_completed",
    message: message
  });
}

// Utility functions
function generateOperationId() {
  return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function broadcastMessage(message) {
  STATE.connections.forEach(connectionId => {
    chrome.runtime.sendMessage(connectionId, message).catch(() => {
      // Remove dead connections
      STATE.connections.delete(connectionId);
    });
  });
}

function cleanupOldOperations() {
  const ONE_HOUR = 60 * 60 * 1000;
  const now = Date.now();

  for (const [id, operation] of STATE.pendingOperations) {
    if (now - operation.timestamp > ONE_HOUR) {
      STATE.pendingOperations.delete(id);
    }
  }
}

// Keep service worker alive
chrome.runtime.onConnect.addListener(port => {
  port.onDisconnect.addListener(() => {
    handlePopupDisconnection({}, { id: port.sender.id });
  });
});