// debug.js
window.DEBUG = true;

// Debug logging function
window.debugLog = function(message) {
  if (window.DEBUG) {
    const debugInfo = document.getElementById('debugInfo');
    if (debugInfo) {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
      debugInfo.innerHTML += `${timestamp}: ${message}<br>`;
      debugInfo.scrollTop = debugInfo.scrollHeight;
      console.log(message);
    }
  }
};

// Log script loading
document.addEventListener('DOMContentLoaded', () => {
  debugLog('Debug script initialized');
  
  // Show debug panel if in debug mode
  if (window.DEBUG) {
    document.getElementById('debugInfo')?.classList.add('show');
  }
  
  debugLog('DOM content loaded');
});

// Log any errors
window.onerror = function(msg, url, line) {
  debugLog(`Error: ${msg} at ${url}:${line}`);
};