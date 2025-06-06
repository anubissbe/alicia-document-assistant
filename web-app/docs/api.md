# API Documentation

## Overview

Document Writer interacts with three main APIs:
1. **LM Studio API** - AI text generation
2. **MCP Server API** - Research and web search
3. **Stable Diffusion API** - Image generation

## LM Studio API

### Base URL
```
http://localhost:1234/v1
```

### Authentication
No authentication required for local instance.

### Endpoints

#### GET /v1/models
List available models.

**Response:**
```json
{
  "data": [
    {
      "id": "model-name",
      "object": "model",
      "created": 1234567890,
      "owned_by": "organization"
    }
  ]
}
```

#### POST /v1/chat/completions
Generate text completion.

**Request:**
```json
{
  "model": "model-name",
  "messages": [
    {
      "role": "system",
      "content": "You are a professional document writer..."
    },
    {
      "role": "user", 
      "content": "Write an introduction about renewable energy"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 4000,
  "stream": false
}
```

**Response:**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "model-name",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Generated text content..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 500,
    "total_tokens": 600
  }
}
```

### Usage in Code

```javascript
// From ai-client.js
async generateContent(prompt, maxTokens = 4000) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: this.model,
            messages: [
                { role: 'system', content: this.systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: maxTokens
        })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
}
```

## MCP Server API

### WebSocket URL
```
ws://localhost:3001
```

### Message Format
JSON-RPC 2.0 protocol over WebSocket.

### Methods

#### search/web
Search the web for information.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "search/web",
  "params": {
    "query": "renewable energy trends 2024"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "results": [
      {
        "title": "Article Title",
        "url": "https://example.com/article",
        "summary": "Brief summary of the article content..."
      }
    ]
  }
}
```

#### fetch/url
Fetch and extract content from a URL.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "fetch/url",
  "params": {
    "url": "https://example.com/article"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "title": "Article Title",
    "content": "Full article content...",
    "summary": "AI-generated summary..."
  }
}
```

### Usage in Code

```javascript
// From mcp-client.js
async search(query) {
    const response = await this.sendRequest('search/web', { query });
    return response.results;
}

async fetchUrl(url) {
    const response = await this.sendRequest('fetch/url', { url });
    return response;
}
```

## Stable Diffusion API

### Base URL
Configurable, typically:
```
http://localhost:7860
```

### Authentication
Optional, depends on configuration.

### Endpoints

#### POST /sdapi/v1/txt2img
Generate image from text prompt.

**Request:**
```json
{
  "prompt": "professional business meeting discussing renewable energy, modern office",
  "negative_prompt": "cartoon, anime, unrealistic",
  "steps": 20,
  "sampler_name": "Euler a",
  "cfg_scale": 7,
  "width": 512,
  "height": 512,
  "n_iter": 1,
  "batch_size": 1
}
```

**Response:**
```json
{
  "images": ["base64-encoded-image-data"],
  "parameters": {
    "prompt": "...",
    "steps": 20
  },
  "info": "{\"prompt\": \"...\", \"seed\": 123456}"
}
```

### Usage in Code

```javascript
// From image-generator.js
async generateWithStableDiffusion(prompt) {
    const response = await fetch(`${this.sdEndpoint}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: this.enhancePrompt(prompt),
            negative_prompt: "cartoon, anime, low quality, blurry",
            steps: 20,
            cfg_scale: 7,
            width: 768,
            height: 512
        })
    });
    
    const data = await response.json();
    return `data:image/png;base64,${data.images[0]}`;
}
```

## Internal APIs

### Document Generator API

```javascript
class DocumentGenerator {
    /**
     * Generate complete document
     * @param {Object} documentData - Document configuration
     * @returns {Promise<string>} Generated markdown content
     */
    async generateDocument(documentData) {
        // Implementation
    }
    
    /**
     * Convert markdown to HTML
     * @param {string} markdown - Markdown content
     * @returns {string} HTML content
     */
    markdownToHTML(markdown) {
        // Implementation
    }
}
```

### File Processor API

```javascript
class FileProcessor {
    /**
     * Process uploaded file
     * @param {File} file - File object
     * @returns {Promise<Object>} Extracted content
     */
    async processFile(file) {
        return {
            name: file.name,
            type: file.type,
            size: file.size,
            content: "extracted text content",
            summary: "AI-generated summary"
        };
    }
}
```

### Settings Manager API

```javascript
class SettingsManager {
    /**
     * Get setting value
     * @param {string} key - Setting key
     * @param {*} defaultValue - Default if not found
     * @returns {*} Setting value
     */
    getSetting(key, defaultValue) {
        // Implementation
    }
    
    /**
     * Save setting
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    setSetting(key, value) {
        // Implementation
    }
}
```

## Error Handling

All APIs should handle errors gracefully:

```javascript
try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
    
} catch (error) {
    console.error('API Error:', error);
    
    if (error.name === 'NetworkError') {
        showToast('Network connection failed', 'error');
    } else if (error.name === 'SyntaxError') {
        showToast('Invalid response from server', 'error');
    } else {
        showToast(`Error: ${error.message}`, 'error');
    }
    
    throw error;
}
```

## Rate Limiting

### LM Studio
- No built-in rate limiting
- Requests queued automatically
- Monitor token usage

### Stable Diffusion
- Depends on configuration
- Typical: 1-2 requests/second
- Queue implementation recommended

### MCP Server
- No rate limiting
- Concurrent requests supported
- WebSocket handles queuing

## Best Practices

### 1. Connection Management
```javascript
// Check connection before requests
if (!this.isConnected) {
    await this.connect();
}
```

### 2. Timeout Handling
```javascript
// Add timeout to fetch requests
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
    const response = await fetch(url, {
        ...options,
        signal: controller.signal
    });
} finally {
    clearTimeout(timeout);
}
```

### 3. Retry Logic
```javascript
async function retryRequest(fn, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
    }
}
```

### 4. Response Validation
```javascript
function validateResponse(response, schema) {
    // Implement JSON schema validation
    // Return validated data or throw error
}
```

## Testing APIs

### LM Studio Test
```bash
curl http://localhost:1234/v1/models
```

### MCP Server Test
```javascript
// In browser console
const ws = new WebSocket('ws://localhost:3001');
ws.onopen = () => {
    ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'search/web',
        params: { query: 'test' }
    }));
};
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

### Stable Diffusion Test
```bash
curl -X POST http://localhost:7860/sdapi/v1/txt2img \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test image", "steps": 1}'
```

## API Configuration

### Environment Variables
```javascript
// config.js
const API_CONFIG = {
    LM_STUDIO_URL: process.env.LM_STUDIO_URL || 'http://localhost:1234/v1',
    MCP_SERVER_URL: process.env.MCP_SERVER_URL || 'ws://localhost:3001',
    SD_API_URL: process.env.SD_API_URL || 'http://localhost:7860'
};
```

### Runtime Configuration
```javascript
// Via settings UI
window.settingsManager.setSetting('lmStudioUrl', 'http://192.168.1.100:1234/v1');
window.settingsManager.setSetting('sdEndpoint', 'http://192.168.1.100:7860');
```