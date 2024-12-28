# ChatBot Knowledge Builder Chrome Extension

A Chrome extension that allows you to build a personalized knowledge base for your chatbot by highlighting and saving text from web pages. The extension uses OpenAI's embeddings to create a vector database of your saved knowledge, enabling semantic search and contextual responses.

## Features

- 🔍 Highlight and save text from any webpage
- 💾 Local vector database storage
- 🤖 OpenAI-powered semantic search
- 🔗 Source URL tracking
- 💬 Interactive chat interface
- 🎯 Context-aware responses
- 🗑️ Easy knowledge management

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/chatbot-knowledge-builder.git
```

2. Open Chrome and go to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the extension directory

## Setup

1. Get an OpenAI API key from [OpenAI's platform](https://platform.openai.com/api-keys)

2. Click the extension icon and go to the Settings tab

3. Enter your OpenAI API key

## Usage

### Adding Knowledge
1. Highlight any text on a webpage
2. Right-click and select "Add to chatbot's knowledge"
3. The text will be saved with its source URL

### Using the Chatbot
1. Click the extension icon
2. Type your question in the chat interface
3. The chatbot will respond using relevant knowledge from your saved content
4. Sources will be displayed with links to original pages

### Managing Knowledge
1. Click the "Stored Knowledge" tab
2. View all saved text snippets with timestamps and source links
3. Delete items using the × button

## Project Structure

```
├── manifest.json           # Extension configuration
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── background.js          # Background service worker
├── chatbot.js            # Chatbot implementation
└── styles.css            # Styling (included in popup.html)
```

## Technical Details

- Uses OpenAI's text-embedding-ada-002 model for embeddings
- Implements cosine similarity for semantic search
- Leverages GPT-3.5-turbo for response generation
- Stores data locally using Chrome's storage API
- Built with vanilla JavaScript and Chrome Extensions Manifest V3

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Privacy

This extension stores all data locally. The only external communication is with OpenAI's API for generating embeddings and responses. Your API key and saved content never leave your browser except when making necessary API calls to OpenAI.