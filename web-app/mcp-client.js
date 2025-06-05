/**
 * MCP (Model Context Protocol) Client for internet search and research capabilities
 */
class MCPClient {
    constructor() {
        this.isConnected = false;
        this.serverUrl = 'ws://localhost:3000'; // MCP server websocket
        this.websocket = null;
        this.requestId = 0;
        this.pendingRequests = new Map();
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
                this.updateConnectionStatus('connected');
            };

            this.websocket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.websocket.onclose = () => {
                console.log('Disconnected from MCP server');
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.connect(), 5000);
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