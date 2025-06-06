# How-To Guide for Document Writer (Alicia)

## Table of Contents
1. [Getting Started](#getting-started)
2. [Creating Documents](#creating-documents)
3. [Using AI Features](#using-ai-features)
4. [Working with Images](#working-with-images)
5. [Research and References](#research-and-references)
6. [Advanced Features](#advanced-features)
7. [Troubleshooting](#troubleshooting)

## Getting Started

### First Time Setup

1. **Install Dependencies**
   ```bash
   cd web-app
   npm install
   ```

2. **Start LM Studio**
   - Download from [lmstudio.ai](https://lmstudio.ai/)
   - Load a model (see recommended models in README)
   - Start server on port 1234

3. **Launch Document Writer**
   ```bash
   npm start
   ```
   - Opens automatically at http://localhost:3000
   - Or use `start-all.cmd` on Windows

4. **Configure Settings** (Optional)
   - Click ⚙️ Settings button
   - Set document preferences
   - Configure Stable Diffusion for images

## Creating Documents

### Step-by-Step Document Creation

#### 1. Select Document Type
Choose from pre-defined templates:
- **Business Document**: Reports, proposals, plans
- **Technical Documentation**: Guides, specifications
- **Academic Paper**: Research papers, essays
- **Report**: Analysis, summaries
- **Letter**: Formal correspondence
- **Custom**: Free-form documents

#### 2. Enter Basic Information
```
Title: Your Document Title
Description: Brief description of the document's purpose
Author: Your Name
Date: Today's date (auto-filled)
```

**Tips:**
- Be specific with your title
- Description helps AI understand context
- Author appears in document header

#### 3. Define Document Structure

**Option A: Manual Sections**
- Click "Add Section"
- Enter section title
- Add description/points
- Reorder by dragging

**Option B: AI-Generated Outline**
- Click "Generate with AI"
- AI creates structure based on type
- Edit as needed

**Example Structure:**
```
1. Executive Summary
   - Overview of key points
   - Main recommendations

2. Introduction
   - Background information
   - Objectives

3. Analysis
   - Current situation
   - Key findings

4. Recommendations
   - Proposed solutions
   - Implementation plan

5. Conclusion
   - Summary
   - Next steps
```

#### 4. Add Resources (Optional)

**Upload Files:**
- Supported: .docx, .pdf, .txt
- Max size: 10MB per file
- AI reads and references content

**Add URLs:**
- Paste article/website URLs
- Click "Add URL"
- AI extracts key information

**Web Search:**
- Enter search query
- Click "Search"
- Select relevant results

#### 5. AI Feedback Chat

Use the chat to refine your document:
```
You: "Make the introduction more engaging"
AI: "I'll add a compelling hook and statistics..."

You: "Add more technical details to section 3"
AI: "I'll expand the technical analysis..."

You: "Include industry best practices"
AI: "I'll add a best practices subsection..."
```

#### 6. Generate Document

**Configure Generation:**
- Minimum pages (default: 3)
- Detail level:
  - Concise: Brief, to the point
  - Standard: Balanced coverage
  - Detailed: Comprehensive
  - Extensive: Maximum detail

**Click "Generate Document"**
- Progress shown in real-time
- Images generated automatically
- Preview updates live

#### 7. Review and Export

**Preview Options:**
- Toggle preview mode
- Check formatting
- Verify content

**Export Formats:**
- **Markdown**: Raw text with formatting
- **HTML**: Web-ready format
- **Word**: .docx for editing
- **PDF**: Print-ready document

## Using AI Features

### Optimizing AI Generation

#### Model Selection
In LM Studio, choose models based on needs:

**For Long Documents (10+ pages):**
```
Mistral-7B-Instruct-v0.3-Q8_0
Temperature: 0.8
Max Tokens: 8192
Context: 8192
```

**For Technical Content:**
```
Nous-Hermes-2-Mistral-7B-DPO
Temperature: 0.7
Top P: 0.9
Repeat Penalty: 1.1
```

#### Prompt Engineering

**Good Prompts:**
```
"Write a comprehensive analysis of renewable energy adoption in manufacturing, including current trends, challenges, and future outlook"
```

**Better Prompts:**
```
"Write a detailed 10-page report analyzing renewable energy adoption in manufacturing. Include:
- Current adoption rates with statistics
- Top 5 challenges facing manufacturers
- Case studies of successful implementations
- Cost-benefit analysis
- 5-year outlook with specific predictions
- Actionable recommendations for manufacturers"
```

### Using the Feedback Chat

**Effective Commands:**
```
"Expand section 2 with more examples"
"Add statistical data to support claims"
"Make the tone more formal/casual"
"Include a comparison table"
"Add transition paragraphs between sections"
"Strengthen the conclusion"
```

**Iterative Refinement:**
1. Generate initial draft
2. Review and identify gaps
3. Use chat for improvements
4. Regenerate specific sections

## Working with Images

### Automatic Image Generation

Alicia generates images based on:
- Document content
- Section topics
- 3 images per 5 pages ratio

### Setting Up Stable Diffusion

1. **Install AUTOMATIC1111 WebUI**
   ```bash
   git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui
   cd stable-diffusion-webui
   ./webui.sh --api --listen
   ```

2. **Configure in Alicia**
   - Settings → Image Generation
   - Enter URL: `http://localhost:7860`
   - Enable Stable Diffusion

### Image Types Generated

**Charts and Graphs:**
- Automatically created from data
- Types: Bar, Line, Pie, Doughnut
- Customizable colors

**Contextual Images:**
- Related to section content
- Professional style
- Relevant to document type

### Customizing Images

Edit image prompts in generated content:
```markdown
![A professional business meeting discussing renewable energy](data:image/...)
```

## Research and References

### Adding Research Sources

#### Method 1: URL Addition
1. Find relevant article
2. Copy URL
3. Paste in Research section
4. Click "Add URL"
5. AI extracts key points

#### Method 2: Web Search
1. Enter search terms
2. Click "Search"
3. Review results
4. Select relevant sources
5. AI incorporates findings

#### Method 3: File Upload
1. Click "Upload Files"
2. Select documents
3. AI reads content
4. References in generation

### Best Practices for Research

**Quality Sources:**
- Academic papers
- Industry reports
- Government data
- Reputable news outlets

**Effective Searches:**
```
"renewable energy manufacturing statistics 2024"
"best practices digital transformation healthcare"
"case studies AI implementation finance"
```

## Advanced Features

### Dark Mode
- Automatic system detection
- Manual toggle (🌙 button)
- Saves preference

### Keyboard Shortcuts

**Essential Shortcuts:**
- `Ctrl+/`: Show all shortcuts
- `Ctrl+S`: Save document
- `Ctrl+Enter`: Generate
- `Alt+←/→`: Navigate steps

**Pro Shortcuts:**
- `Ctrl+1-8`: Jump to step
- `Ctrl+E`: Export
- `Ctrl+H`: Version history
- `Ctrl+P`: Print preview

### Version Control

**Saving Versions:**
1. Generate document
2. Click 📚 Version History
3. Click "Save Current Version"
4. Name your version
5. Add notes (optional)

**Restoring Versions:**
1. Open Version History
2. Find desired version
3. Click "Load"
4. Confirm restoration

### Document Sharing

**Create Share Link:**
1. Click 🔗 Share button
2. Copy generated link
3. Share via:
   - Email
   - WhatsApp
   - LinkedIn
   - QR Code

**Link Limitations:**
- 5000 character limit
- Compressed content
- Read-only access

### Export/Import Projects

**Export Project:**
1. Click 📥 Export
2. Saves as .json file
3. Includes all data

**Import Project:**
1. Click Import (Ctrl+I)
2. Select .json file
3. Continues where left off

### Print Optimization

**Configure Print:**
1. Click 🖨️ Print
2. Adjust settings:
   - Font size
   - Margins
   - Headers/footers
   - Color mode

**Print Tips:**
- Use "Grayscale" for B&W printers
- Adjust margins for binding
- Preview before printing

## Troubleshooting

### Common Issues and Solutions

#### "AI Not Connected"
```bash
# Check LM Studio is running
curl http://localhost:1234/v1/models

# If not, start LM Studio and load model
```

#### "Images Not Generating"
1. Check Stable Diffusion running
2. Verify endpoint in settings
3. Test with curl:
   ```bash
   curl http://localhost:7860/sdapi/v1/txt2img
   ```

#### "Document Too Short"
- Increase minimum pages
- Use "Detailed" or "Extensive" level
- Add more sections
- Provide detailed descriptions

#### "Research Not Working"
```bash
# Check MCP server
npm run mcp-server

# Verify WebSocket connection in browser console
```

### Debug Mode

Enable for detailed logging:
```javascript
// In browser console
localStorage.setItem('debugMode', 'true');
location.reload();
```

Or add to URL: `?debug=true`

### Performance Tips

**Faster Generation:**
- Use smaller models (3B-7B)
- Reduce detail level
- Disable images
- Limit sections

**Better Quality:**
- Use larger models (13B+)
- "Extensive" detail level
- More research sources
- Detailed descriptions

### Browser Issues

**Clear Cache:**
```
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

**Check Console:**
```
F12 → Console tab
Look for red errors
```

## Best Practices

### Document Planning
1. Clear objective
2. Target audience
3. Detailed outline
4. Relevant research
5. Specific requirements

### Effective Prompts
- Be specific
- Include examples
- Set expectations
- Define scope
- Request structure

### Quality Control
1. Review generated content
2. Verify facts
3. Check formatting
4. Test all links
5. Proofread carefully

### Workflow Tips
- Save versions frequently
- Use keyboard shortcuts
- Enable auto-save
- Export backups
- Document settings

## Getting Help

### Resources
- Press `Ctrl+/` for shortcuts
- Click ❓ for help
- Enable debug mode
- Check browser console

### Support
- GitHub Issues
- Community Discord
- Email support

Remember: Alicia is your assistant, not a replacement for human review. Always verify important information and tailor content to your specific needs.