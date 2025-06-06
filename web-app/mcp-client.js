/**
 * MCP (Model Context Protocol) Client for internet search and research capabilities
 */
class MCPClient {
    constructor() {
        this.isConnected = false;
        // Use secure WebSocket if available, fallback to non-secure for localhost
        this.serverUrl = window.location.protocol === 'https:' ? 'wss://localhost:3000' : 'ws://localhost:3000';
        this.websocket = null;
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.reconnectAttempts = 0;
        this.baseReconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        this.connect();
    }

    /**
     * Connect to MCP server
     */
    async connect() {
        try {
            this.websocket = new WebSocket(this.serverUrl);
            
            this.websocket.onopen = () => {
                console.log('Connected to MCP server');
                this.isConnected = true;
                this.reconnectAttempts = 0; // Reset on successful connection
                this.updateConnectionStatus('connected');
            };

            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Failed to parse MCP server message:', error);
                    console.error('Raw message:', event.data);
                    if (window.showToast) {
                        window.showToast('Research server sent invalid response', 'error');
                    }
                }
            };

            this.websocket.onclose = () => {
                console.log('Disconnected from MCP server');
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                
                // Implement exponential backoff for reconnection
                if (this.reconnectAttempts < 5) {
                    const delay = Math.min(
                        this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
                        this.maxReconnectDelay
                    );
                    this.reconnectAttempts++;
                    console.log(`Reconnecting in ${delay/1000} seconds... (attempt ${this.reconnectAttempts})`);
                    
                    if (this.reconnectAttempts === 5 && window.showToast) {
                        window.showToast('Research server unavailable. Continuing without research features.', 'warning');
                    }
                    
                    setTimeout(() => this.connect(), delay);
                } else {
                    console.log('Max reconnection attempts reached. Research features disabled.');
                    if (window.showToast) {
                        window.showToast('Research server connection failed. You can continue without research features.', 'warning');
                    }
                }
            };

            this.websocket.onerror = (error) => {
                console.error('MCP WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus('error');
            };

        } catch (error) {
            console.error('Failed to connect to MCP server:', error);
            this.isConnected = false;
            this.updateConnectionStatus('error');
        }
    }

    /**
     * Send request to MCP server
     */
    async sendRequest(method, params = {}) {
        if (!this.isConnected || !this.websocket) {
            throw new Error('MCP server not connected');
        }

        const requestId = ++this.requestId;
        const message = {
            jsonrpc: '2.0',
            id: requestId,
            method: method,
            params: params
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });
            this.websocket.send(JSON.stringify(message));
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Handle incoming messages
     */
    handleMessage(message) {
        if (message.id && this.pendingRequests.has(message.id)) {
            const { resolve, reject } = this.pendingRequests.get(message.id);
            this.pendingRequests.delete(message.id);

            if (message.error) {
                reject(new Error(message.error.message || 'MCP request failed'));
            } else {
                resolve(message.result);
            }
        }
    }

    /**
     * Search the internet for information
     */
    async searchWeb(query, options = {}) {
        const params = {
            query: query,
            maxResults: options.maxResults || 5,
            searchType: options.searchType || 'general'
        };

        try {
            const result = await this.sendRequest('search/web', params);
            return result.results || [];
        } catch (error) {
            console.error('Web search failed:', error);
            throw error;
        }
    }

    /**
     * Get content from a URL
     */
    async fetchUrl(url, options = {}) {
        const params = {
            url: url,
            extractText: options.extractText !== false,
            maxLength: options.maxLength || 10000
        };

        try {
            const result = await this.sendRequest('fetch/url', params);
            return result;
        } catch (error) {
            console.error('URL fetch failed:', error);
            throw error;
        }
    }

    /**
     * Extract and summarize content from multiple sources
     */
    async gatherResearch(topic, urls = [], options = {}) {
        const params = {
            topic: topic,
            urls: urls,
            maxSources: options.maxSources || 5,
            summarize: options.summarize !== false
        };

        try {
            const result = await this.sendRequest('research/gather', params);
            return result;
        } catch (error) {
            console.error('Research gathering failed:', error);
            throw error;
        }
    }

    /**
     * Update connection status in UI
     */
    updateConnectionStatus(status) {
        const mcpStatus = document.getElementById('mcp-status');
        if (mcpStatus) {
            mcpStatus.className = `mcp-status ${status}`;
            mcpStatus.textContent = status === 'connected' ? 'Research: Connected' : 
                                   status === 'error' ? 'Research: Error' : 'Research: Disconnected';
        }
    }
}

// Create global MCP client instance
window.mcpClient = new MCPClient();