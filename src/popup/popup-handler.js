import Knowledge from '../knowledge.js';

export class PopupHandler {
  constructor() {
    this.initElements();
    this.bindEvents();
    this.initLLM();
  }

  initElements() {
    this.loading = document.getElementById('loading');
    this.main = document.getElementById('main');
    this.chat = document.getElementById('chat');
    this.input = document.getElementById('input');
    this.send = document.getElementById('send');
    this.response = document.getElementById('response');
    this.knowledgeList = document.getElementById('knowledge-list');
    this.tabButtons = document.querySelectorAll('.tab-button');
  }

  bindEvents() {
    // Chat events
    this.send.addEventListener('click', () => this.handleSend());
    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Tab switching
    this.tabButtons.forEach(button => {
      button.addEventListener('click', () => this.switchTab(button.dataset.tab));
    });
  }

  async initLLM() {
    try {
      await Knowledge.initLLM((progress) => {
        this.loading.textContent = `Loading model: ${Math.round(progress.progress * 100)}%`;
        if (progress.progress === 1) {
          this.loading.style.display = 'none';
          this.main.style.display = 'block';
          this.refreshKnowledgeList(); // Load knowledge items
        }
      });
    } catch (error) {
      this.loading.textContent = `Error loading model: ${error.message}`;
    }
  }

  switchTab(tabId) {
    // Update button states
    this.tabButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabId);
    });

    // Update content visibility
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === tabId);
    });

    // Refresh knowledge list when switching to that tab
    if (tabId === 'knowledge') {
      this.refreshKnowledgeList();
    }
  }

  async handleSend() {
    const query = this.input.value.trim();
    if (!query) return;

    this.response.textContent = 'Thinking...';
    this.input.value = '';

    try {
      const result = await Knowledge.search(query);
      this.displayResponse(result);
    } catch (error) {
      this.response.textContent = `Error: ${error.message}`;
    }
  }

  displayResponse(result) {
    this.response.innerHTML = `
      <div class="response-text">${result.response}</div>
      ${result.sources?.length ? `
        <div class="sources">
          <strong>Sources:</strong>
          ${result.sources.map(s => `
            <div><a href="${s.url}" target="_blank">${s.title || 'Source'}</a></div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  async refreshKnowledgeList() {
    const vectors = await Knowledge.getVectors();
    
    this.knowledgeList.innerHTML = vectors.length === 0 
      ? '<div class="knowledge-item">No knowledge stored yet. Highlight text on any webpage and use the right-click menu to add it.</div>'
      : vectors.map(vector => `
          <div class="knowledge-item">
            <div class="knowledge-text">${this.truncateText(vector.text, 200)}</div>
            <div class="knowledge-meta">
              <a href="${vector.url}" target="_blank" class="knowledge-source">${vector.title || 'Source'}</a>
              <span>${new Date(vector.timestamp).toLocaleString()}</span>
            </div>
            <button class="knowledge-delete" data-timestamp="${vector.timestamp}">×</button>
          </div>
        `).join('');

    // Add delete handlers
    this.knowledgeList.querySelectorAll('.knowledge-delete').forEach(button => {
      button.addEventListener('click', () => this.deleteKnowledgeItem(button.dataset.timestamp));
    });
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  async deleteKnowledgeItem(timestamp) {
    const vectors = await Knowledge.getVectors();
    const updatedVectors = vectors.filter(v => v.timestamp !== parseInt(timestamp));
    await chrome.storage.local.set({ vectors: updatedVectors });
    this.refreshKnowledgeList();
  }
}

