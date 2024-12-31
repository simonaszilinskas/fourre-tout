// background.js
import KnowledgeService from './knowledge-service.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addToKnowledge",
    title: "Add to chatbot's knowledge",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "addToKnowledge") {
    try {
      await processSelection(info.selectionText, tab.url, tab.title);
    } catch (error) {
      notifyError(error);
    }
  }
});

async function processSelection(text, url, title) {
  try {
    await KnowledgeService.storeKnowledge(text, url, title);
    
    // Show success notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Knowledge Base Updated',
      message: 'Text successfully added to knowledge base'
    });

    // Notify any open popups
    chrome.runtime.sendMessage({
      type: "knowledge_updated",
      data: { text, url, title }
    }).catch(() => {
      // Ignore error if no listeners
    });
    
  } catch (error) {
    throw new Error(`Failed to process selection: ${error.message}`);
  }
}

function notifyError(error) {
  console.error("Error processing text:", error);
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'Error',
    message: error.message || 'An unexpected error occurred'
  });
}

// Listen for error reports from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "report_error") {
    notifyError(new Error(message.error));
  }
  return true;
});