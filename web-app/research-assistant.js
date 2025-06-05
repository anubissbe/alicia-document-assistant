/**
 * Research Assistant for gathering web information and URL content
 */
class ResearchAssistant {
    constructor() {
        this.researchData = [];
        this.isResearching = false;
    }

    /**
     * Create research UI component
     */
    createResearchUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const researchArea = document.createElement('div');
        researchArea.className = 'research-area';
        researchArea.innerHTML = `
            <div class="research-controls">
                <h4>🔍 Research Assistant</h4>
                
                <div class="url-input-section">
                    <h5>Add Reference URLs</h5>
                    <div class="url-input-group">
                        <input type="url" id="url-input" placeholder="https://example.com/article" class="form-input">
                        <button class="secondary-button" id="add-url-btn">Add URL</button>
                    </div>
                    <small>Add websites, articles, or documentation to reference in your document</small>
                </div>
                
                <div class="search-section">
                    <h5>Web Search</h5>
                    <div class="search-input-group">
                        <input type="text" id="search-input" placeholder="Search for information about..." class="form-input">
                        <button class="secondary-button" id="search-btn">Search Web</button>
                    </div>
                    <div class="search-options">
                        <label>
                            <input type="checkbox" id="auto-summarize" checked>
                            Auto-summarize search results
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="research-results" id="research-results" style="display: none;">
                <h5>Research Results</h5>
                <div class="results-list" id="results-list"></div>
                <div class="research-actions">
                    <button class="primary-button" id="use-research-btn">
                        🤖 Use Research in Document
                    </button>
                    <button class="secondary-button" id="clear-research-btn">
                        🗑️ Clear Research
                    </button>
                </div>
            </div>
        `;

        container.appendChild(researchArea);
        this.setupResearchHandlers();
    }

    /**
     * Setup research event handlers
     */
    setupResearchHandlers() {
        const urlInput = document.getElementById('url-input');
        const addUrlBtn = document.getElementById('add-url-btn');
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');
        const useResearchBtn = document.getElementById('use-research-btn');
        const clearResearchBtn = document.getElementById('clear-research-btn');

        if (addUrlBtn) {
            addUrlBtn.addEventListener('click', () => this.addUrl());
        }

        if (urlInput) {
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addUrl();
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.performWebSearch());
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performWebSearch();
            });
        }

        if (useResearchBtn) {
            useResearchBtn.addEventListener('click', () => this.useResearchInDocument());
        }

        if (clearResearchBtn) {
            clearResearchBtn.addEventListener('click', () => this.clearResearch());
        }
    }

    /**
     * Add URL to research
     */
    async addUrl() {
        const urlInput = document.getElementById('url-input');
        if (!urlInput || !urlInput.value.trim()) return;

        const url = urlInput.value.trim();
        
        // Validate URL
        try {
            new URL(url);
        } catch (error) {
            showToast('Please enter a valid URL', 'error');
            return;
        }

        try {
            showLoading(`Fetching content from ${url}...`);
            
            let content = '';
            let title = url;
            let fetchSuccess = false;
            
            // Try to fetch via MCP if available
            if (window.mcpClient && window.mcpClient.isConnected) {
                try {
                    const result = await window.mcpClient.fetchUrl(url, {
                        extractText: true,
                        maxLength: 5000
                    });
                    content = result.content || result.text || '';
                    title = result.title || url;
                    fetchSuccess = true;
                } catch (mcpError) {
                    console.warn('MCP fetch failed, trying alternative method:', mcpError);
                }
            }
            
            // If MCP failed or not available, try CORS proxy
            if (!fetchSuccess) {
                try {
                    const proxyResult = await this.fetchUrlViaProxy(url);
                    content = proxyResult.content;
                    title = proxyResult.title || url;
                    fetchSuccess = true;
                } catch (proxyError) {
                    console.warn('Proxy fetch failed:', proxyError);
                    
                    // As last resort, add URL without content
                    content = 'Unable to fetch content automatically. Please ensure the MCP server is running or manually copy relevant content.';
                    title = url;
                }
            }

            // Generate summary if content is available
            let summary = 'No content extracted';
            if (content && content.length > 100 && !content.includes('Unable to fetch')) {
                summary = await this.generateContentSummary(content);
            } else if (content.includes('Unable to fetch')) {
                summary = 'Content could not be fetched automatically. URL saved for reference.';
            }

            const researchItem = {
                type: 'url',
                url: url,
                title: title,
                content: content,
                summary: summary,
                timestamp: new Date().toISOString()
            };

            this.researchData.push(researchItem);
            this.addResearchItemToUI(researchItem);
            
            urlInput.value = '';
            hideLoading();
            
            if (fetchSuccess && !content.includes('Unable to fetch')) {
                showToast('URL content added to research', 'success');
            } else {
                showToast('URL saved, but content could not be fetched. Ensure MCP server is running.', 'warning');
            }
            
        } catch (error) {
            hideLoading();
            showToast(`Failed to process URL: ${error.message}`, 'error');
        }
    }

    /**
     * Fetch URL content via CORS proxy
     */
    async fetchUrlViaProxy(url) {
        const proxies = [
            {
                name: 'allorigins',
                url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
                parser: (data) => data.contents
            },
            {
                name: 'corsproxy',
                url: `https://corsproxy.io/?${encodeURIComponent(url)}`,
                parser: (data) => data
            }
        ];

        let lastError = null;
        
        for (const proxy of proxies) {
            try {
                console.log(`Trying ${proxy.name} proxy...`);
                const response = await fetch(proxy.url, {
                    signal: AbortSignal.timeout(15000) // 15 second timeout
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                let content;
                if (proxy.name === 'allorigins') {
                    const data = await response.json();
                    content = proxy.parser(data);
                } else {
                    content = await response.text();
                }
                
                const extractedText = this.extractTextFromHTML(content);
                const title = this.extractTitleFromHTML(content) || url;
                
                return {
                    content: extractedText,
                    title: title
                };
                
            } catch (error) {
                // Handle QUIC protocol errors and other network issues gracefully
                if (error.name === 'AbortError') {
                    console.warn(`${proxy.name} proxy timed out`);
                } else if (error.message.includes('ERR_QUIC_PROTOCOL_ERROR')) {
                    console.warn(`${proxy.name} proxy QUIC protocol error - trying next proxy`);
                } else {
                    console.warn(`${proxy.name} proxy failed:`, error.message);
                }
                lastError = error;
            }
        }
        
        throw new Error(lastError?.message || 'All proxy attempts failed');
    }

    /**
     * Fetch URL content directly (legacy method)
     */
    async fetchUrlDirect(url) {
        return this.fetchUrlViaProxy(url);
    }

    /**
     * Extract title from HTML
     */
    extractTitleFromHTML(html) {
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (titleMatch) {
            return titleMatch[1].trim();
        }
        return null;
    }

    /**
     * Extract text content from HTML
     */
    extractTextFromHTML(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove script and style elements
        const scripts = tempDiv.querySelectorAll('script, style, nav, header, footer');
        scripts.forEach(el => el.remove());
        
        // Get text content
        let text = tempDiv.textContent || tempDiv.innerText || '';
        
        // Clean up whitespace
        text = text.replace(/\s+/g, ' ').trim();
        
        // Limit length
        return text.substring(0, 5000);
    }

    /**
     * Perform web search
     */
    async performWebSearch() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput || !searchInput.value.trim()) return;

        const query = searchInput.value.trim();
        
        try {
            showLoading(`Searching for: ${query}`);
            
            let searchResults = [];
            
            // Try MCP search if available
            if (window.mcpClient && window.mcpClient.isConnected) {
                try {
                    searchResults = await window.mcpClient.searchWeb(query, {
                        maxResults: 5,
                        searchType: 'general'
                    });
                } catch (mcpError) {
                    console.warn('MCP search failed:', mcpError);
                    showToast('MCP search not available, try adding URLs manually', 'warning');
                    hideLoading();
                    return;
                }
            } else {
                // Fallback: suggest manual URL addition
                hideLoading();
                showToast('Web search requires MCP server. Please add URLs manually.', 'warning');
                return;
            }

            // Process search results
            for (const result of searchResults) {
                const autoSummarize = document.getElementById('auto-summarize')?.checked !== false;
                
                let summary = result.snippet || result.description || 'No summary available';
                if (autoSummarize && result.content && result.content.length > 200) {
                    summary = await this.generateContentSummary(result.content);
                }

                const researchItem = {
                    type: 'search',
                    query: query,
                    title: result.title || result.url,
                    url: result.url,
                    content: result.content || result.snippet || '',
                    summary: summary,
                    timestamp: new Date().toISOString()
                };

                this.researchData.push(researchItem);
                this.addResearchItemToUI(researchItem);
            }
            
            searchInput.value = '';
            hideLoading();
            showToast(`Found ${searchResults.length} search results`, 'success');
            
        } catch (error) {
            hideLoading();
            showToast(`Search failed: ${error.message}`, 'error');
        }
    }

    /**
     * Generate content summary using AI
     */
    async generateContentSummary(content, maxLength = 300) {
        if (!window.aiClient || !window.aiClient.isConnected) {
            return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
        }

        try {
            const prompt = `Please provide a concise summary of the following content in ${maxLength} characters or less. Focus on the key information and main points:

${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}`;

            const summary = await window.aiClient.generateText(prompt, {
                temperature: 0.3,
                maxTokens: 100
            });

            return summary;
        } catch (error) {
            console.error('Summary generation failed:', error);
            return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
        }
    }

    /**
     * Add research item to UI
     */
    addResearchItemToUI(item) {
        const resultsList = document.getElementById('results-list');
        const resultsContainer = document.getElementById('research-results');
        
        if (!resultsList || !resultsContainer) return;

        const resultItem = document.createElement('div');
        resultItem.className = 'research-item';
        resultItem.innerHTML = `
            <div class="research-header">
                <h6>${item.title}</h6>
                <span class="research-type">${item.type === 'url' ? '🔗' : '🔍'} ${item.type}</span>
            </div>
            <div class="research-content">
                <p class="research-summary">${item.summary}</p>
                ${item.url ? `<small class="research-url">Source: <a href="${item.url}" target="_blank">${item.url}</a></small>` : ''}
            </div>
            <div class="research-actions">
                <button class="secondary-button" onclick="researchAssistant.previewResearch(${this.researchData.length - 1})">
                    👁️ Preview
                </button>
                <button class="secondary-button" onclick="researchAssistant.removeResearch(${this.researchData.length - 1})">
                    🗑️ Remove
                </button>
            </div>
        `;

        resultsList.appendChild(resultItem);
        resultsContainer.style.display = 'block';
    }

    /**
     * Preview research content
     */
    previewResearch(index) {
        const item = this.researchData[index];
        if (!item) return;

        const previewWindow = window.open('', '_blank');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Research Preview: ${item.title}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                    .header { border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; }
                    .content { white-space: pre-wrap; line-height: 1.6; }
                    .summary { background: #f5f5f5; padding: 15px; border-left: 4px solid #007acc; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${item.title}</h1>
                    <p><strong>Type:</strong> ${item.type} | <strong>Source:</strong> ${item.url || 'N/A'}</p>
                </div>
                <div class="summary">
                    <h3>Summary</h3>
                    <p>${item.summary}</p>
                </div>
                <div class="content">
                    <h3>Full Content</h3>
                    ${item.content}
                </div>
            </body>
            </html>
        `);
        previewWindow.document.close();
    }

    /**
     * Remove research item
     */
    removeResearch(index) {
        this.researchData.splice(index, 1);
        this.refreshResearchUI();
        showToast('Research item removed', 'success');
    }

    /**
     * Clear all research
     */
    clearResearch() {
        this.researchData = [];
        this.refreshResearchUI();
        showToast('All research cleared', 'success');
    }

    /**
     * Refresh research UI
     */
    refreshResearchUI() {
        const resultsList = document.getElementById('results-list');
        const resultsContainer = document.getElementById('research-results');
        
        if (resultsList) {
            resultsList.innerHTML = '';
        }
        
        if (resultsContainer) {
            resultsContainer.style.display = this.researchData.length > 0 ? 'block' : 'none';
        }
        
        // Re-add all items
        this.researchData.forEach((item, index) => {
            this.addResearchItemToUI(item);
        });
    }

    /**
     * Use research in document generation
     */
    useResearchInDocument() {
        if (this.researchData.length === 0) {
            showToast('No research data to use', 'warning');
            return;
        }

        // Store research context globally for AI use
        window.researchContext = this.getResearchContext();
        showToast(`Research context prepared (${this.researchData.length} sources)`, 'success');
    }

    /**
     * Get formatted research context for AI
     */
    getResearchContext() {
        if (this.researchData.length === 0) return '';

        let context = '\n\n--- RESEARCH CONTEXT ---\n';
        
        this.researchData.forEach((item, index) => {
            context += `\n${index + 1}. ${item.title}\n`;
            context += `Source: ${item.url || 'Search result'}\n`;
            context += `Summary: ${item.summary}\n`;
            context += `Content: ${item.content.substring(0, 1000)}${item.content.length > 1000 ? '...' : ''}\n`;
            context += '---\n';
        });
        
        context += '\n--- END RESEARCH CONTEXT ---\n\n';
        context += 'Please use the information from this research to enhance and inform the content you generate. Reference these sources appropriately.\n\n';
        
        return context;
    }
}

// Create global research assistant instance
window.researchAssistant = new ResearchAssistant();