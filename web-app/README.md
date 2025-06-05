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

- 🤖 **AI-Powered Intelligence**: Alicia uses advanced AI to understand your requirements and generate tailored content
- 🎨 **Smart Visual Generation**: Automatically creates charts, diagrams, and infographics to enhance your documents
- 🔍 **Research Assistant**: Alicia can search the web and analyze sources to enrich your content
- 📄 **Multiple Export Formats**: Export to DOCX, PDF, HTML, and Markdown
- 📎 **Document Analysis**: Upload existing documents for Alicia to read, understand, and reference
- 🌐 **URL Intelligence**: Add websites and articles as research sources
- 💬 **Interactive Refinement**: Chat with Alicia to perfect your documents
- 📊 **Smart Templates**: Pre-built templates optimized for different document types
- ✨ **Real-time Preview**: See your document come to life as Alicia works

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

4. **Meet Alicia:**
   Navigate to `http://localhost:8000` in your browser to start working with your personal document assistant.

### Setting Up Alicia's AI Brain

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Load a language model (Alicia works best with: qwen2.5-coder-7b-instruct-128k)
3. Start the local server on port 1234
4. Alicia will automatically connect and be ready to assist you

## Working with Alicia

### Alicia's Document Creation Process

1. **Select Document Type**: Choose from business, technical, academic, report, letter, or custom
2. **Document Details**: Enter title, description, author, and date
3. **Upload Files**: Add Word documents for AI reference (optional)
4. **Add Research**: Include URLs or search the web for additional context (optional)
5. **Define Sections**: Create custom sections or use AI-generated outlines
6. **AI Generation**: Let AI generate your complete document
7. **Review & Download**: Preview and download in your preferred format

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

## About Alicia

Alicia was created to be your trusted document assistant, combining the power of AI with an intuitive interface to make document creation a pleasure rather than a chore.

## License

MIT License - see LICENSE file for details