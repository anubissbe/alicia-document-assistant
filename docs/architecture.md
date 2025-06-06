# Document Writer Architecture

## Overview

Document Writer (Alicia) is a web-based document generation assistant built with a modular, event-driven architecture. The application follows a clean separation of concerns with distinct modules for different functionalities.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │   UI Layer  │  │ App Core     │  │  Service Modules      │ │
│  │             │  │              │  │                       │ │
│  │ - index.html│  │ - app.js     │  │ - ai-client.js       │ │
│  │ - styles.css│  │ - init.js    │  │ - document-generator │ │
│  │ - dark-mode │  │ - dom-utils  │  │ - image-generator    │ │
│  │ - responsive│  │ - error-     │  │ - file-processor     │ │
│  │             │  │   handler    │  │ - research-assistant │ │
│  └─────────────┘  └──────────────┘  └───────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Feature Modules                       │  │
│  │                                                          │  │
│  │  - theme-manager    - export-import   - print-preview   │  │
│  │  - auto-save        - document-stats  - share-document  │  │
│  │  - version-history  - keyboard-shortcuts                │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                        External Services                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  LM Studio   │  │ MCP Server   │  │ Stable Diffusion   │   │
│  │  (AI Model)  │  │  (Research)  │  │ (Image Generation) │   │
│  │              │  │              │  │                    │   │
│  │ localhost:   │  │ localhost:   │  │ Configurable       │   │
│  │    1234      │  │    3001      │  │    Endpoint        │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Application Core

#### `app.js`
- Main application controller
- Manages wizard workflow and state
- Handles navigation between steps
- Coordinates all modules

#### `init.js`
- Global initialization
- Ensures dependencies are loaded
- Sets up global utilities
- Configures debug mode

#### `error-handler.js`
- Global error boundary
- Unhandled promise rejection handling
- Error logging and reporting
- User-friendly error messages

#### `dom-utils.js`
- Safe DOM manipulation utilities
- Element existence checking
- XSS-safe content updates

### 2. Service Modules

#### `ai-client.js`
- LM Studio API integration
- Chat completion requests
- Model management
- Connection status monitoring

#### `document-generator.js`
- Document creation logic
- Template processing
- Markdown to HTML conversion
- Export format handling

#### `image-generator.js`
- Stable Diffusion integration
- Chart generation with Chart.js
- Image storage management
- Contextual image prompts

#### `file-processor.js`
- File upload handling
- Document text extraction
- Support for DOCX, PDF, TXT
- Dynamic library loading

#### `research-assistant.js`
- URL content fetching
- Web search integration
- Research data management
- Content summarization

### 3. Infrastructure Modules

#### `mcp-client.js`
- WebSocket client for MCP server
- Research server communication
- Exponential backoff reconnection
- Request/response handling

#### `mcp-server.js`
- Node.js WebSocket server
- Web search capabilities
- URL content extraction
- CORS handling

#### `sanitizer.js`
- HTML content sanitization
- XSS prevention
- Safe content rendering

#### `settings-manager.js`
- Application settings persistence
- LocalStorage management
- Default configuration

### 4. Feature Modules

#### `theme-manager.js`
- Dark mode support
- System theme detection
- Theme persistence

#### `auto-save.js`
- Automatic document saving
- Dirty state tracking
- Recovery on reload

#### `keyboard-shortcuts.js`
- Global keyboard handling
- Shortcut registration
- Help dialog

#### `export-import.js`
- Project save/load
- JSON serialization
- File download/upload

#### `document-stats.js`
- Real-time statistics
- Word/page counting
- Reading time calculation

#### `share-document.js`
- Shareable link generation
- URL compression
- Social media integration

#### `version-history.js`
- Document versioning
- Change tracking
- Version restoration

#### `print-preview.js`
- Print formatting
- Preview generation
- Custom print styles

## Data Flow

### 1. Document Generation Flow
```
User Input → app.js → document-generator.js → ai-client.js → LM Studio
                                           ↓
                                    image-generator.js → Stable Diffusion
                                           ↓
                                    Preview & Export
```

### 2. Research Flow
```
User adds URL/Search → research-assistant.js → mcp-client.js
                                             ↓
                                      mcp-server.js → Web APIs
                                             ↓
                                    Summarized Content
```

### 3. State Management
- Application state is centralized in `app.js`
- Settings persisted via `settings-manager.js`
- Auto-save handled by `auto-save.js`
- Version history tracked by `version-history.js`

## Security Considerations

### XSS Prevention
- All user content sanitized via `sanitizer.js`
- Safe DOM updates through `dom-utils.js`
- Content Security Policy headers recommended

### Data Privacy
- All processing happens client-side
- No data sent to external servers (except configured APIs)
- LocalStorage for persistence
- Optional features clearly marked

### Error Handling
- Global error boundaries
- Graceful degradation
- User-friendly error messages
- Debug mode for development

## Performance Optimizations

### Lazy Loading
- Chart.js loaded via CDN
- Dynamic imports for file processors
- Feature modules loaded on-demand

### Memory Management
- Image storage limits
- Cleanup on navigation
- Event listener management
- Interval clearing

### Caching
- Settings cached in memory
- Template caching
- Research results stored

## Browser Compatibility

### Supported Browsers
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Required APIs
- Fetch API
- WebSocket API
- File API
- LocalStorage
- Canvas API

## Development Guidelines

### Code Style
- ES6+ JavaScript
- Async/await for promises
- Descriptive function names
- JSDoc comments

### Module Pattern
- Each file exports to window object
- Clear initialization
- Cleanup methods
- Error handling

### Testing Approach
- Manual testing for UI
- Console debugging
- Error tracking
- Performance monitoring

## Deployment

### Production Build
1. Minify JavaScript files
2. Combine CSS files
3. Optimize images
4. Enable gzip compression

### Environment Configuration
- No build process required
- Direct file serving
- Configure API endpoints
- Enable HTTPS recommended

## Future Enhancements

### Planned Features
- Real-time collaboration
- Cloud storage integration
- Plugin system
- Advanced templates

### Architecture Improvements
- TypeScript migration
- Module bundling
- Service worker caching
- WebAssembly for performance