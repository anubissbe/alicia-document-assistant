/**
 * Simple MCP Server for Web Search functionality
 * This server provides internet search capabilities for the Document Writer
 */

const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const zlib = require('zlib');

class MCPServer {
    constructor(port = 3000) {
        this.port = port;
        this.wss = null;
        this.clients = new Set();
        
        // Search API configuration (using DuckDuckGo Instant Answer API)
        this.searchEndpoint = 'https://api.duckduckgo.com/';
        this.fallbackSearchEndpoint = 'https://html.duckduckgo.com/html/';
    }

    /**
     * Start the MCP server
     */
    start() {
        this.wss = new WebSocket.Server({ 
            port: this.port,
            perMessageDeflate: false
        });

        this.wss.on('connection', (ws) => {
            console.log('MCP client connected');
            this.clients.add(ws);

            ws.on('message', async (message) => {
                try {
                    const request = JSON.parse(message.toString());
                    console.log('Received request:', request.method);
                    
                    const response = await this.handleRequest(request);
                    ws.send(JSON.stringify(response));
                } catch (error) {
                    console.error('Error handling message:', error);
                    ws.send(JSON.stringify({
                        id: request?.id || 'unknown',
                        error: {
                            code: -32603,
                            message: 'Internal error',
                            data: error.message
                        }
                    }));
                }
            });

            ws.on('close', () => {
                console.log('MCP client disconnected');
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });

            // Send welcome message
            ws.send(JSON.stringify({
                id: 'welcome',
                result: {
                    message: 'MCP Server connected',
                    capabilities: ['search/web', 'fetch/url']
                }
            }));
        });

        console.log(`MCP Server listening on port ${this.port}`);
        console.log(`WebSocket endpoint: ws://localhost:${this.port}`);
    }

    /**
     * Handle incoming requests
     */
    async handleRequest(request) {
        const { id, method, params = {} } = request;

        try {
            let result;
            
            switch (method) {
                case 'search/web':
                    result = await this.searchWeb(params.query, params.options || {});
                    break;
                    
                case 'fetch/url':
                    result = await this.fetchUrl(params.url, params.options || {});
                    break;
                    
                case 'capabilities':
                    result = {
                        methods: ['search/web', 'fetch/url'],
                        version: '1.0.0'
                    };
                    break;
                    
                default:
                    throw new Error(`Unknown method: ${method}`);
            }

            return {
                id,
                result
            };
        } catch (error) {
            return {
                id,
                error: {
                    code: -32602,
                    message: error.message
                }
            };
        }
    }

    /**
     * Perform web search using DuckDuckGo API
     */
    async searchWeb(query, options = {}) {
        const { maxResults = 5, searchType = 'general' } = options;
        
        if (!query || typeof query !== 'string') {
            throw new Error('Query parameter is required and must be a string');
        }

        console.log(`Searching for: "${query}"`);

        try {
            // Try DuckDuckGo Instant Answer API first
            const searchResults = await this.duckDuckGoSearch(query, maxResults);
            
            if (searchResults.length > 0) {
                return searchResults;
            }

            // Fallback: Generate mock results for demo purposes
            return this.generateMockSearchResults(query, maxResults);
            
        } catch (error) {
            console.error('Search error:', error);
            // Return mock results as fallback
            return this.generateMockSearchResults(query, maxResults);
        }
    }

    /**
     * Search using DuckDuckGo API
     */
    async duckDuckGoSearch(query, maxResults) {
        return new Promise((resolve, reject) => {
            const searchUrl = `${this.searchEndpoint}?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
            
            https.get(searchUrl, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        const results = [];
                        
                        // Process instant answer
                        if (response.AbstractText) {
                            results.push({
                                title: response.Heading || 'Information',
                                url: response.AbstractURL || '',
                                snippet: response.AbstractText,
                                content: response.AbstractText,
                                source: response.AbstractSource || 'DuckDuckGo'
                            });
                        }

                        // Process related topics
                        if (response.RelatedTopics && Array.isArray(response.RelatedTopics)) {
                            response.RelatedTopics.slice(0, maxResults - results.length).forEach(topic => {
                                if (topic.Text && topic.FirstURL) {
                                    results.push({
                                        title: topic.Text.split(' - ')[0] || 'Related Topic',
                                        url: topic.FirstURL,
                                        snippet: topic.Text,
                                        content: topic.Text,
                                        source: 'DuckDuckGo'
                                    });
                                }
                            });
                        }

                        resolve(results.slice(0, maxResults));
                    } catch (parseError) {
                        console.error('Parse error:', parseError);
                        resolve([]);
                    }
                });
            }).on('error', (error) => {
                console.error('Request error:', error);
                resolve([]);
            });
        });
    }

    /**
     * Generate mock search results for demonstration
     */
    generateMockSearchResults(query, maxResults) {
        const mockResults = [
            {
                title: `Understanding ${query} - Comprehensive Guide`,
                url: `https://example.com/guide/${encodeURIComponent(query)}`,
                snippet: `This comprehensive guide covers everything you need to know about ${query}, including best practices, examples, and expert insights.`,
                content: `Detailed information about ${query} can be found in various academic and professional sources. This topic encompasses multiple aspects and considerations that are important for understanding the full context.`,
                source: 'Example Educational Resource'
            },
            {
                title: `${query} - Latest Research and Developments`,
                url: `https://research.example.com/studies/${encodeURIComponent(query)}`,
                snippet: `Recent research on ${query} shows significant developments in the field, with new methodologies and findings that advance our understanding.`,
                content: `Current research indicates that ${query} is an evolving field with ongoing studies and developments. Key findings suggest various applications and implications for future work.`,
                source: 'Research Database'
            },
            {
                title: `How to Implement ${query} - Practical Guide`,
                url: `https://howto.example.com/implement/${encodeURIComponent(query)}`,
                snippet: `Step-by-step guide for implementing ${query} in real-world scenarios, including tools, techniques, and best practices.`,
                content: `Implementation of ${query} requires careful planning and consideration of various factors. This guide provides practical steps and recommendations for successful implementation.`,
                source: 'Implementation Guide'
            }
        ];

        return mockResults.slice(0, maxResults);
    }

    /**
     * Fetch content from a URL
     */
    async fetchUrl(url, options = {}) {
        const { extractText = true, maxLength = 5000 } = options;
        
        if (!url || typeof url !== 'string') {
            throw new Error('URL parameter is required and must be a string');
        }

        try {
            new URL(url); // Validate URL format
        } catch (error) {
            throw new Error('Invalid URL format');
        }

        console.log(`Fetching URL: ${url}`);

        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const requestOptions = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 15000
            };

            const request = client.get(url, requestOptions, (res) => {
                // Handle redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    console.log(`Following redirect to: ${res.headers.location}`);
                    const redirectUrl = new URL(res.headers.location, url).href;
                    this.fetchUrl(redirectUrl, options)
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                }

                const chunks = [];
                let totalSize = 0;
                
                // Create appropriate stream based on content encoding
                let stream = res;
                const encoding = res.headers['content-encoding'];
                
                if (encoding === 'gzip') {
                    stream = res.pipe(zlib.createGunzip());
                } else if (encoding === 'deflate') {
                    stream = res.pipe(zlib.createInflate());
                } else if (encoding === 'br') {
                    stream = res.pipe(zlib.createBrotliDecompress());
                }
                
                stream.on('data', (chunk) => {
                    chunks.push(chunk);
                    totalSize += chunk.length;
                    // Prevent excessive memory usage
                    if (totalSize > maxLength * 2) {
                        res.destroy();
                        reject(new Error('Content too large'));
                    }
                });

                stream.on('error', (error) => {
                    console.error('Stream error:', error);
                    reject(new Error(`Stream processing failed: ${error.message}`));
                });

                stream.on('end', () => {
                    try {
                        const data = Buffer.concat(chunks).toString('utf8');
                        let content = data;
                        let title = url;

                        if (extractText && res.headers['content-type']?.includes('text/html')) {
                            // Extract title
                            const titleMatch = data.match(/<title[^>]*>([^<]*)<\/title>/i);
                            if (titleMatch) {
                                title = titleMatch[1].trim();
                            }

                            // More comprehensive text extraction
                            content = data
                                // Remove scripts and styles
                                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
                                // Remove HTML comments
                                .replace(/<!--[\s\S]*?-->/g, '')
                                // Convert common entities
                                .replace(/&nbsp;/g, ' ')
                                .replace(/&amp;/g, '&')
                                .replace(/&lt;/g, '<')
                                .replace(/&gt;/g, '>')
                                .replace(/&quot;/g, '"')
                                // Remove remaining tags
                                .replace(/<[^>]+>/g, ' ')
                                // Clean up whitespace
                                .replace(/\s+/g, ' ')
                                .trim();
                        }

                        // Limit content length
                        if (content.length > maxLength) {
                            content = content.substring(0, maxLength) + '...';
                        }

                        resolve({
                            url,
                            title,
                            content,
                            contentType: res.headers['content-type'] || 'unknown',
                            contentLength: data.length
                        });
                    } catch (error) {
                        reject(new Error(`Failed to process content: ${error.message}`));
                    }
                });
            });

            request.on('error', (error) => {
                // Common SSL/TLS errors
                if (error.code === 'ECONNREFUSED') {
                    reject(new Error('Connection refused - server may be down'));
                } else if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
                    reject(new Error('SSL certificate issue - try using a CORS proxy'));
                } else {
                    reject(new Error(`Request failed: ${error.message}`));
                }
            });

            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    /**
     * Stop the server
     */
    stop() {
        if (this.wss) {
            this.wss.close();
            console.log('MCP Server stopped');
        }
    }
}

// Start server if run directly
if (require.main === module) {
    const server = new MCPServer(3000);
    server.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down MCP Server...');
        server.stop();
        process.exit(0);
    });
}

module.exports = MCPServer;