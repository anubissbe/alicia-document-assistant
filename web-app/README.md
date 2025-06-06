# Alicia - Your Personal Document Assistant

👩‍💼 Alicia is your intelligent personal document assistant, designed to help you create professional documents effortlessly. With advanced AI capabilities and intuitive design, Alicia transforms the way you write.

## Meet Alicia

Alicia is more than just a document writer - she's your personal assistant who understands your needs and helps you create:
- 📑 Professional business documents
- 🔬 Technical documentation
- 📚 Academic papers
- 📊 Comprehensive reports
- ✉️ Formal letters
- 📝 Custom documents

## Features

### Core Features
- 🤖 **AI-Powered Intelligence**: Alicia uses advanced AI to understand your requirements and generate tailored content
- 🎨 **Smart Visual Generation**: Automatically creates contextual images, charts, and diagrams using Stable Diffusion
- 🔍 **Research Assistant**: Alicia can search the web and analyze sources to enrich your content
- 📄 **Multiple Export Formats**: Export to DOCX, PDF, HTML, and Markdown
- 📎 **Document Analysis**: Upload existing documents for Alicia to read, understand, and reference
- 🌐 **URL Intelligence**: Add websites and articles as research sources
- 💬 **Interactive Refinement**: Chat with Alicia to perfect your documents
- 📊 **Smart Templates**: Pre-built templates optimized for different document types
- ✨ **Real-time Preview**: See your document come to life as Alicia works

### New Features (v2.0)
- 🌙 **Dark Mode**: Easy on the eyes with automatic theme detection
- 📱 **Mobile Responsive**: Works seamlessly on tablets and smartphones  
- 💾 **Auto-Save**: Never lose your work with automatic saving every 30 seconds
- 📊 **Document Statistics**: Real-time word count, page count, reading time
- 🔗 **Share Documents**: Generate shareable links for easy collaboration
- 📚 **Version History**: Track changes and restore previous versions
- 🖨️ **Print Preview**: Customizable print settings with live preview
- ⌨️ **Keyboard Shortcuts**: Speed up your workflow (press Ctrl+/ for help)
- 🌍 **Export/Import Projects**: Save and load complete document projects
- 🛡️ **Enhanced Security**: XSS protection and sanitized content
- ⚡ **Performance Improvements**: Faster loading and better error handling

## Quick Start

### Prerequisites

- Node.js (for MCP server)
- LM Studio running on localhost:1234
- Modern web browser

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start all services:**
   ```bash
   npm start
   ```
   This will start both the web server and MCP research server.

   **Alternative methods:**
   - Windows: `start-all.cmd` or `start-all.ps1`
   - Unix/Linux/Mac: `./start-all.sh`
   - Debug mode: `npm run start-debug`

3. **Meet Alicia:**
   Navigate to `http://localhost:3000` in your browser to start working with your personal document assistant.

### Setting Up Alicia's AI Brain

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Load a language model (see recommended models below)
3. Start the local server on port 1234
4. Alicia will automatically connect and be ready to assist you

#### Recommended AI Models for Long Documents

For generating documents that meet minimum page requirements, we recommend:

**Best for Long Documents (7+ pages):**
- **Mistral-7B-Instruct-v0.3-Q8_0** - Best balance of quality and length
- **Nous-Hermes-2-Mistral-7B-DPO** - Excellent for detailed content
- **OpenHermes-2.5-Mistral-7B** - Good for comprehensive documents

**Also Good:**
- **Llama-3-8B-Instruct** - Reliable for structured documents
- **Qwen2.5-7B-Instruct** - Great for technical content
- **Zephyr-7B-Beta** - Good general purpose model

**LM Studio Settings for Better Results:**
- **Temperature:** 0.7-0.8 (higher for more creative content)
- **Max Tokens:** 8192 or higher
- **Context Length:** 8192 or higher
- **Top P:** 0.9
- **Repeat Penalty:** 1.1

**Pro Tip:** Enable "Keep model loaded" in LM Studio for faster generation

## Working with Alicia

### Alicia's Document Creation Process

1. **Select Document Type**: Choose from business, technical, academic, report, letter, or custom
2. **Document Details**: Enter title, description, author, and date
3. **Upload Files**: Add Word documents for AI reference (optional)
4. **Add Research**: Include URLs or search the web for additional context (optional)
5. **Define Sections**: Create custom sections or use AI-generated outlines
6. **AI Generation**: Let AI generate your complete document
7. **Review & Download**: Preview and download in your preferred format

### Keyboard Shortcuts

Press `Ctrl+/` anytime to see all available shortcuts. Here are the most useful ones:

| Shortcut | Action |
|----------|--------|
| `Ctrl+/` | Show keyboard shortcuts help |
| `Ctrl+S` | Save document |
| `Ctrl+E` | Export document |
| `Ctrl+I` | Import document |
| `Ctrl+H` | Show version history |
| `Ctrl+P` | Print settings & preview |
| `Ctrl+Shift+S` | Share document |
| `Ctrl+Shift+I` | Show document statistics |
| `Alt+←` | Previous step |
| `Alt+→` | Next step |
| `Ctrl+Enter` | Generate document |
| `Ctrl+1-8` | Navigate to specific steps |
| `Esc` | Close any open dialog |

### How Alicia Helps You

#### Document Understanding
- Upload DOCX and PDF files for Alicia to analyze
- Alicia extracts and understands the content
- Get intelligent summaries of uploaded documents

#### Alicia's Research Skills
- Share URLs with Alicia for additional context
- Alicia can search the web for relevant information
- Get concise summaries of research materials
- All research is intelligently incorporated into your documents

#### Alicia's Intelligence
- Powered by advanced AI through LM Studio
- Creates compelling titles, structured outlines, and complete documents
- Learns from your uploaded files and research
- Offers multiple ways to enhance and perfect your content

## Technical Architecture

### Components

- **Frontend**: Vanilla HTML/CSS/JavaScript (no frameworks)
- **MCP Server**: Node.js WebSocket server for internet search
- **AI Client**: Connects to LM Studio's OpenAI-compatible API
- **File Processor**: Handles document uploads and text extraction
- **Research Assistant**: Manages URL content and web search

### API Endpoints

#### LM Studio API (localhost:1234)
- `POST /v1/chat/completions` - AI text generation
- `GET /v1/models` - Available models

#### MCP Server (localhost:3000)
- `search/web` - Web search functionality
- `fetch/url` - URL content extraction

## Configuration

### Environment Variables

No environment variables required - all configuration is handled in the JavaScript files.

### Customizing Alicia

- **Alicia's AI Model**: Change model in `ai-client.js`
- **Communication Port**: Modify port in `mcp-server.js` and `mcp-client.js`
- **Search Capabilities**: Update search endpoints in `mcp-server.js`

### Image Generation Setup (Optional)

Alicia can create contextual images for your documents using Stable Diffusion:

1. **Install Stable Diffusion** (e.g., AUTOMATIC1111's WebUI)
2. **Start with API enabled**: `--api --listen`
3. **Configure in Alicia's settings**:
   - Click ⚙️ Settings
   - Enter your SD endpoint (e.g., `http://192.168.1.25:8000`)
   - Enable image generation
   
**Image Scaling**: Alicia automatically generates 3 images per 5 pages of content

### Settings & Configuration

Click the ⚙️ button to access:
- **Document Settings**: Minimum pages, detail level
- **AI Settings**: LM Studio URL and model selection
- **Image Settings**: Stable Diffusion endpoint and toggle
- **Theme**: Automatic dark mode detection

## Troubleshooting

### If Alicia Can't Connect
- Ensure LM Studio is running on port 1234
- Check that Alicia's AI model is loaded in LM Studio
- Verify firewall settings allow localhost connections

### If Alicia Can't Search the Web
- Ensure Alicia's search server is running: `npm run mcp-server`
- Check WebSocket connection in browser developer tools
- You can still manually provide URLs for Alicia to analyze

### File Upload Issues
- Ensure files are in supported formats (DOCX, PDF, TXT)
- Check file size limits (default: 10MB)
- Verify browser supports File API

### Debug Mode
To enable debug mode for detailed logging and troubleshooting:

**PowerShell (Windows):**
```powershell
# Start servers with debug mode
$env:DEBUG = "true"
npm run mcp-server
# In a new terminal:
npm run web-server
```

**Command Prompt (Windows):**
```cmd
# Start servers with debug mode
set DEBUG=true
npm run mcp-server
# In a new terminal:
npm run web-server
```

**Alternative Method:**
Add `?debug=true` to your URL: `http://localhost:8000/?debug=true`

Debug mode provides:
- Detailed API call logging
- Request/response tracking
- Image generation debugging
- Performance metrics
- Error details

## Development

### Project Structure
```
web-app/
├── index.html              # Main application
├── styles.css              # Core styling
├── dark-mode.css           # Dark theme styles
├── responsive.css          # Mobile responsive styles
├── app.js                  # Main application logic
├── init.js                 # Initialization and global setup
├── error-handler.js        # Global error handling
├── dom-utils.js            # Safe DOM manipulation utilities
├── ai-client.js            # LM Studio integration
├── image-generator.js      # Stable Diffusion integration
├── mcp-client.js           # MCP WebSocket client
├── mcp-server.js           # MCP search server
├── file-processor.js       # File upload handling
├── research-assistant.js   # Research and URL management
├── document-generator.js   # Document generation logic
├── sanitizer.js            # HTML/content sanitization
├── settings-manager.js     # Application settings
├── auto-save.js            # Auto-save functionality
├── keyboard-shortcuts.js   # Keyboard shortcut handler
├── theme-manager.js        # Dark mode support
├── export-import.js        # Project save/load
├── document-stats.js       # Statistics tracking
├── share-document.js       # Document sharing
├── version-history.js      # Version control
├── print-preview.js        # Print functionality
└── package.json           # Node.js dependencies
```

### Adding New Features

1. **New Document Types**: Add to `document-generator.js` templates
2. **New AI Features**: Extend `ai-client.js` methods
3. **New File Types**: Update `file-processor.js` extractors
4. **New Search Sources**: Modify `mcp-server.js` search methods

## About Alicia

Alicia was created to be your trusted document assistant, combining the power of AI with an intuitive interface to make document creation a pleasure rather than a chore.

## License

MIT License - see LICENSE file for details