# Alicia - Your Personal Document Assistant (Web App)

<div align="center">
  <img src="Alicia-logo.png" alt="Alicia Logo" width="200"/>
  
  👩‍💼 **Meet Alicia - Your Intelligent Document Creation Assistant**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js](https://img.shields.io/badge/Node.js-14%2B-green)](https://nodejs.org/)
  [![LM Studio](https://img.shields.io/badge/LM%20Studio-Compatible-blue)](https://lmstudio.ai/)
</div>

## 🌟 Overview

Alicia is a powerful web-based document creation assistant that combines advanced AI capabilities with an intuitive interface. Create professional documents, technical documentation, academic papers, and more with the help of your personal AI assistant.

## ✨ Key Features

### 🤖 AI-Powered Intelligence
- **Smart Content Generation**: Alicia uses LM Studio to understand your requirements and generate tailored content
- **Context-Aware Writing**: Upload reference documents for Alicia to analyze and learn from
- **Intelligent Outlines**: Get AI-generated document structures optimized for your needs

### 🎨 Visual Content Creation
- **Automatic Image Generation**: Creates contextual images using Stable Diffusion
- **Smart Charts & Diagrams**: Visualize data automatically
- **Scaling**: 3 images per 5 pages of content

### 🔍 Research Integration
- **Web Search**: Built-in research capabilities
- **URL Analysis**: Add websites as reference sources
- **Content Summarization**: Get concise summaries of research materials

### 📄 Professional Output
- **Multiple Formats**: Export to DOCX, PDF, HTML, and Markdown
- **Templates**: Pre-built templates for various document types
- **Print-Ready**: Customizable print settings with live preview

### 💡 Modern Features
- **Dark Mode**: Automatic theme detection
- **Mobile Responsive**: Works on all devices
- **Auto-Save**: Never lose your work
- **Version History**: Track changes over time
- **Document Sharing**: Generate shareable links
- **Keyboard Shortcuts**: Speed up your workflow

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ 
- [LM Studio](https://lmstudio.ai/) with a loaded model
- Modern web browser (Chrome, Firefox, Edge, Safari)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/anubissbe/alicia-document-assistant.git
   cd alicia-document-assistant
   ```

2. **Install dependencies:**
   ```bash
   cd web-app
   npm install
   ```

3. **Start the application:**
   ```bash
   npm start
   ```
   This starts both the web server and MCP research server.

4. **Open Alicia:**
   Navigate to `http://localhost:3000` in your browser.

### Setting Up AI

1. **Install [LM Studio](https://lmstudio.ai/)**
2. **Download a model** (see recommendations below)
3. **Start the server** on port 1234
4. **Alicia connects automatically**

## 📚 Recommended AI Models

For best results with long documents:

### Top Picks
- **Mistral-7B-Instruct-v0.3-Q8_0** - Best balance
- **Nous-Hermes-2-Mistral-7B-DPO** - Detailed content
- **OpenHermes-2.5-Mistral-7B** - Comprehensive docs

### LM Studio Settings
- Temperature: 0.7-0.8
- Max Tokens: 8192+
- Context Length: 8192+
- Top P: 0.9
- Repeat Penalty: 1.1

## 📖 How to Use Alicia

### Document Creation Process

1. **Choose Document Type**
   - Business documents
   - Technical documentation
   - Academic papers
   - Reports & letters
   - Custom documents

2. **Provide Details**
   - Title and description
   - Author information
   - Target length

3. **Add Context (Optional)**
   - Upload reference documents
   - Add research URLs
   - Let Alicia search the web

4. **Define Structure**
   - Use AI-generated outlines
   - Create custom sections
   - Specify requirements

5. **Generate & Refine**
   - Watch Alicia create your document
   - Chat to make adjustments
   - Preview in real-time

6. **Export & Share**
   - Download in your preferred format
   - Share via link
   - Print with custom settings

## ⌨️ Keyboard Shortcuts

Press `Ctrl+/` to see all shortcuts. Common ones:

- `Ctrl+S` - Save document
- `Ctrl+E` - Export document
- `Ctrl+I` - Import document
- `Ctrl+H` - Version history
- `Ctrl+P` - Print preview
- `Ctrl+Enter` - Generate document

## 🛠️ Configuration

### Optional: Image Generation

1. Install [Stable Diffusion WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
2. Start with `--api --listen`
3. Configure in Alicia's settings (⚙️)

### Settings

Access settings with the ⚙️ button:
- Document preferences
- AI model selection
- Image generation toggle
- Theme preferences

## 🏗️ Project Structure

```
web-app/
├── index.html              # Main application
├── styles.css              # Core styling
├── app.js                  # Application logic
├── ai-client.js            # LM Studio integration
├── mcp-server.js           # Research server
├── document-generator.js   # Document creation
├── image-generator.js      # SD integration
└── [other modules]         # Supporting features
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- LM Studio for local AI capabilities
- The open-source community for inspiration
- All contributors and users

---

<div align="center">
  Made with ❤️ by Alicia - Your Personal Document Assistant
</div>