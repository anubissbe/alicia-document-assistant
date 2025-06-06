# Alicia - Your Personal Document Assistant

👩‍💼 Meet Alicia, your intelligent personal document assistant. Available as both a VS Code extension and a standalone web application, Alicia transforms the way you create professional documents. With advanced AI capabilities powered by LM Studio and seamless integration with Cline AI assistant through the Model Context Protocol (MCP), Alicia makes document creation effortless and enjoyable.

<img src="Alicia-logo.png" alt="Alicia Logo" width="200" height="200" align="right">

## 🚀 Alicia Web Application

Alicia is available as a beautiful, intuitive web application that runs right in your browser - no installation required!

### What Alicia Can Do For You

- 🤖 **AI-Powered Intelligence** - Alicia connects to LM Studio to understand your needs and generate perfect content
- 🎨 **Smart Visual Creation** - Automatically generates charts, diagrams, and infographics to enhance your documents
- 🔍 **Research Assistant** - Alicia searches the web and analyzes sources to enrich your content
- 📄 **Multiple Export Formats** - Export to DOCX, PDF, HTML, and Markdown with perfect formatting
- 📎 **Document Understanding** - Upload existing documents for Alicia to read, analyze, and reference
- 🌐 **URL Intelligence** - Share websites and articles for Alicia to incorporate into your work
- 💬 **Interactive Refinement** - Chat with Alicia to perfect every detail of your document
- ✨ **Real-time Preview** - Watch your document come to life as Alicia works her magic

### Getting Started with Alicia

1. Navigate to the `web-app` directory
2. Install dependencies: `npm install`
3. Start Alicia's research server: `npm run mcp-server`
4. In a new terminal, start web server: `python -m http.server 8000`
5. Open your browser and meet Alicia at `http://localhost:8000`
6. Ensure LM Studio is running on port 1234 for Alicia's AI capabilities

## Alicia VS Code Extension

- **Document Generation Engine** - Create professional documents using templates and dynamic content
- **AI Integration** - Leverage Cline AI assistant for intelligent content generation and document analysis
- **Chart Generation** - Include dynamic charts and visualizations in your documents
- **Template Management** - Organize and use document templates with metadata
- **Multi-Format Support** - Generate documents in multiple formats

## Installation

1. Install Visual Studio Code 1.85.0 or higher
2. Search for "Alicia Document Assistant" in the VS Code Extensions marketplace
3. Click Install to add Alicia to VS Code
4. Reload VS Code to activate Alicia

## Usage

### Creating a Document

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Document Writer: Create New Document"
3. Follow the wizard to select a document type and enter basic information
4. The extension will generate a document based on your inputs

### Using AI Assistance

1. Open the Command Palette
2. Type "Document Writer: Ask Cline to Create Document"
3. Describe the document you want to create
4. Cline will analyze your requirements and suggest appropriate templates and content

### Managing Templates

1. Click on the Document Writer icon in the Activity Bar
2. Browse the available templates in the Document Templates view
3. Right-click on a template to use it or view its properties

## Project Structure

```plaintext
document-writer/
├── src/                           # Source code
│   ├── extension.ts               # Main extension entry point
│   ├── core/                      # Core document processing
│   │   ├── templateEngine.ts      # Template processing
│   │   ├── chartGenerator.ts      # Chart generation
│   │   └── aiDocumentGenerator.ts # AI document generation
│   ├── integrations/              # External integrations
│   │   └── clineIntegration.ts    # Cline MCP integration
│   ├── models/                    # Data models
│   ├── services/                  # Services
│   │   ├── documentService.ts     # Document management
│   │   └── templateManagerService.ts # Template management
│   ├── providers/                 # VS Code providers
│   ├── webview/                   # Webview interfaces
│   └── utils/                     # Utility functions
├── resources/                     # Resources
│   └── templates/                 # Document templates
└── test/                          # Test files
```

## Development

### Prerequisites

- Node.js 16.x or higher
- npm 8.x or higher
- Visual Studio Code

### Setup

1. Clone the repository
   ```bash
   git clone https://github.com/anubissbe/document-writer.git
   ```

2. Install dependencies
   ```bash
   cd document-writer
   npm install
   ```

3. Build the extension
   ```bash
   npm run compile
   ```

4. Launch the extension in debug mode
   - Press F5 in VS Code to launch a new window with the extension loaded

### Testing

Run the tests with:

```bash
npm test
```

## Dependencies

- docxtemplater - Word document generation
- pizzip - ZIP file handling for DOCX
- chart.js and canvas - Chart generation
- handlebars - Template engine
- puppeteer - PDF generation (planned)

## Implementation Progress

The project is being implemented in phases:

1. ✅ **Phase 1: Foundation Setup** - Project configuration, extension structure, document engine, template management, basic DOCX generation
2. ✅ **Phase 2: AI Integration** - Cline MCP integration, template engine, chart generation, AI document generation, MCP tools
3. ✅ **Phase 3: User Interface Development** - Webview interfaces, document creation wizard, chat-based assistant, tree view provider
4. ✅ **Phase 3.5: Web Application** - Standalone browser-based version with full AI integration
5. ✅ **Phase 4: Advanced Features** - Multi-format support (DOCX, PDF, HTML, Markdown), enhanced AI capabilities, feedback chat system
6. 🚧 **Phase 5: Polish and Release** - Documentation, example templates, publishing preparation

## License

[MIT](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Recent Updates

### Web Application (New!)
- ✅ Complete browser-based document creation interface
- ✅ LM Studio integration for AI-powered generation
- ✅ MCP server for internet search capabilities
- ✅ File upload support (DOCX, PDF, TXT)
- ✅ URL research and content extraction
- ✅ AI feedback chat for document refinement
- ✅ Export to DOCX, PDF, HTML, and Markdown

### VS Code Extension
- ✅ Fixed Document Creation Wizard issues
- ✅ Resolved template loading problems
- ✅ Fixed JavaScript/CSS mismatches in webviews
- ✅ Improved error handling and user feedback

## Todo

- Polish VS Code extension UI based on web app improvements
- Add more document templates for common use cases
- Implement real-time collaboration features
- Add support for more file formats (ODT, RTF)
- Finalize documentation and example templates
- Prepare the extension for release on VS Code marketplace
