# Document Writer Web Application

A browser-based document creation tool with AI integration and internet search capabilities.

## Features

- 🤖 **AI Integration**: Connect to LM Studio for AI-powered document generation
- 🔍 **Internet Search**: MCP server provides web search functionality
- 📄 **Multiple Export Formats**: Export to DOCX, PDF, HTML, and Markdown
- 📎 **File Upload**: Upload Word documents for AI to read and reference
- 🌐 **URL Research**: Add websites and articles as research sources
- 💬 **AI Feedback Chat**: Refine documents through interactive AI conversations
- 📊 **Smart Templates**: Pre-built templates for different document types
- ✨ **Real-time Preview**: See changes as you make them

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

2. **Start the MCP server:**
   ```bash
   npm run mcp-server
   ```

3. **Start a web server** (in a new terminal):
   ```bash
   npm run web-server
   ```
   Or use any static file server like Live Server in VS Code.

4. **Open the application:**
   Navigate to `http://localhost:8000` in your browser.

### LM Studio Setup

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Load a language model (recommended: qwen2.5-coder-7b-instruct-128k)
3. Start the local server on port 1234
4. The web app will automatically connect

## Usage

### Document Creation Wizard

1. **Select Document Type**: Choose from business, technical, academic, report, letter, or custom
2. **Document Details**: Enter title, description, author, and date
3. **Upload Files**: Add Word documents for AI reference (optional)
4. **Add Research**: Include URLs or search the web for additional context (optional)
5. **Define Sections**: Create custom sections or use AI-generated outlines
6. **AI Generation**: Let AI generate your complete document
7. **Review & Download**: Preview and download in your preferred format

### Features in Detail

#### File Upload
- Supports DOCX and PDF files
- AI extracts text content for reference
- Summarizes uploaded documents automatically

#### Research Assistant
- Add reference URLs for additional context
- Web search via MCP server (when available)
- AI summarizes research content
- All research is included in document generation context

#### AI Integration
- Connects to LM Studio API (OpenAI-compatible)
- Generates titles, outlines, and complete documents
- Uses uploaded files and research for enhanced content
- Multiple generation options and content improvement tools

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

### Customization

- **AI Model**: Change model in `ai-client.js`
- **MCP Port**: Modify port in `mcp-server.js` and `mcp-client.js`
- **Search Provider**: Update search endpoints in `mcp-server.js`

## Troubleshooting

### AI Connection Issues
- Ensure LM Studio is running on port 1234
- Check that a model is loaded in LM Studio
- Verify firewall settings allow localhost connections

### MCP Search Not Working
- Ensure MCP server is running: `npm run mcp-server`
- Check WebSocket connection in browser developer tools
- Use manual URL addition as fallback

### File Upload Issues
- Ensure files are in supported formats (DOCX, PDF, TXT)
- Check file size limits (default: 10MB)
- Verify browser supports File API

## Development

### Project Structure
```
web-app/
├── index.html              # Main application
├── styles.css              # Styling
├── app.js                  # Main application logic
├── ai-client.js            # LM Studio integration
├── mcp-client.js           # MCP WebSocket client
├── mcp-server.js           # MCP search server
├── file-processor.js       # File upload handling
├── research-assistant.js   # Research and URL management
├── document-generator.js   # Document generation logic
└── package.json           # Node.js dependencies
```

### Adding New Features

1. **New Document Types**: Add to `document-generator.js` templates
2. **New AI Features**: Extend `ai-client.js` methods
3. **New File Types**: Update `file-processor.js` extractors
4. **New Search Sources**: Modify `mcp-server.js` search methods

## License

MIT License - see LICENSE file for details