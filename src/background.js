import Knowledge from './knowledge.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addToKnowledge",
    title: "Add to knowledge base",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "addToKnowledge") {
    await Knowledge.storeText(info.selectionText, tab.url, tab.title);
  }
});