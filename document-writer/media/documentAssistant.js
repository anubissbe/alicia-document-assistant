// @ts-check
(function () {
    // Get references to DOM elements
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    // Get DOM elements
    const chatContainerEl = document.getElementById('messages');
    const suggestionsContainerEl = document.getElementById('suggestions-container');
    const messageInputEl = document.getElementById('message-input');
    const sendButtonEl = document.getElementById('send-button');
    const typingIndicatorEl = document.querySelector('.typing-indicator');
    
    // Validate required elements
    if (!chatContainerEl) throw new Error('Chat container element not found');
    if (!suggestionsContainerEl) throw new Error('Suggestions container element not found');
    if (!messageInputEl) throw new Error('Message input element not found');
    if (!sendButtonEl) throw new Error('Send button element not found');
    if (!typingIndicatorEl) throw new Error('Typing indicator element not found');
    
    // Cast DOM elements with proper types after validation
    /** @type {HTMLElement} */
    const chatContainer = chatContainerEl;
    /** @type {HTMLElement} */
    const suggestionsContainer = suggestionsContainerEl;
    /** @type {HTMLTextAreaElement} */
    const messageInput = /** @type {HTMLTextAreaElement} */ (messageInputEl);
    /** @type {HTMLButtonElement} */
    const sendButton = /** @type {HTMLButtonElement} */ (sendButtonEl);
    /** @type {HTMLElement} */
    const typingIndicator = /** @type {HTMLElement} */ (typingIndicatorEl);
    
    // Store messages in memory for state persistence
    /** @type {Array<{id: string, content: string, timestamp: Date, type: 'user' | 'assistant', intent?: string, entities?: Array<{name: string, value: string, type: string}>, suggestions?: string[]}>} */
    let messages = [];
    
    /** @type {string|null} */
    let activeDocumentName = null;
    /** @type {string|null} */
    let activeDocumentPath = null;

    /**
     * Initialize the webview
     */
    function initialize() {
        // Set up event listeners
        messageInput.addEventListener('keydown', handleKeyDown);
        sendButton.addEventListener('click', sendMessage);
        
        // Request conversation history when webview becomes visible
        vscode.postMessage({
            command: 'requestHistory'
        });
    }
    
    /**
     * Handle keydown events on the message input
     * @param {KeyboardEvent} event 
     */
    function handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
        
        // Allow shift+enter for newlines
        if (event.key === 'Enter' && event.shiftKey) {
            // Let default behavior occur (adds a newline)
            return;
        }
    }
    
    /**
     * Send a message to the extension
     */
    function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) {
            return;
        }
        
        // Create user message object
        const userMessage = {
            id: crypto.randomUUID(),
            content: message,
            timestamp: new Date(),
            type: /** @type {'user'} */ ('user')
        };
        
        // Add message to chat
        addMessageToChat(userMessage);
        
        // Clear input
        messageInput.value = '';
        
        // Show typing indicator
        showTypingIndicator();
        
        // Send message to extension
        vscode.postMessage({
            command: 'sendMessage',
            text: message
        });
    }
    
    /**
     * Add a message to the chat
     * @param {{id: string, content: string, timestamp: Date, type: 'user' | 'assistant', intent?: string, entities?: Array<{name: string, value: string, type: string}>, suggestions?: string[]}} message
     */
    function addMessageToChat(message) {
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.id = message.id;
        messageElement.className = `message ${message.type}-message`;
        
        // Create message content
        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        contentElement.innerHTML = formatMessageContent(message.content);
        messageElement.appendChild(contentElement);
        
        // Create timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = formatTimestamp(message.timestamp);
        messageElement.appendChild(timestamp);
        
        // Add message to container
        chatContainer.appendChild(messageElement);
        
        // Add suggestions if present and sender is assistant
        if (message.type === 'assistant' && message.suggestions && message.suggestions.length > 0) {
            updateSuggestions(message.suggestions);
        } else if (message.type === 'user') {
            // Clear suggestions when user sends a message
            clearSuggestions();
        }
        
        // Store message in memory
        messages.push(message);
        
        // Scroll to bottom
        scrollToBottom();
    }
    
    /**
     * Format a timestamp for display
     * @param {Date|string} timestamp 
     * @returns {string}
     */
    function formatTimestamp(timestamp) {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    /**
     * Format message content with markdown-like syntax
     * @param {string} content 
     * @returns {string}
     */
    function formatMessageContent(content) {
        if (!content) return '';
        
        // Convert line breaks to <br>
        content = content.replace(/\n/g, '<br>');
        
        // Convert URLs to links
        content = content.replace(
            /(https?:\/\/[^\s]+)/g, 
            '<a href="$1" class="message-link" target="_blank">$1</a>'
        );
        
        // Convert **text** to bold
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert *text* to italic
        content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert `code` to code span
        content = content.replace(/\`(.*?)\`/g, '<code>$1</code>');
        
        // Convert > quotes to blockquotes
        content = content.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
        
        // Convert ## headings (h2)
        content = content.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
        
        // Convert # headings (h1)
        content = content.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
        
        // Convert unordered lists
        content = content.replace(/^- (.*?)$/gm, '<li>$1</li>');
        content = content.replace(/(<li>.*?<\/li>)\s*<br><li>/g, '$1<li>');
        content = content.replace(/(<li>.*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>');
        
        // Convert ordered lists
        content = content.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>');
        content = content.replace(/(<li>.*?<\/li>)\s*<br><li>/g, '$1<li>');
        content = content.replace(/(<li>.*?<\/li>)(?!\s*<li>)/g, '<ol>$1</ol>');
        
        return content;
    }
    
    /**
     * Update suggestions shown below the chat
     * @param {Array<string>} suggestions 
     */
    function updateSuggestions(suggestions) {
        // Clear existing suggestions
        clearSuggestions();
        
        if (!suggestions || suggestions.length === 0) {
            return;
        }
        
        // Add new suggestions
        for (const suggestion of suggestions) {
            const suggestionButton = document.createElement('button');
            suggestionButton.className = 'suggestion-button';
            suggestionButton.textContent = suggestion;
            suggestionButton.addEventListener('click', () => {
                // Send the suggestion as a message
                vscode.postMessage({
                    command: 'suggestionSelected',
                    text: suggestion
                });
                
                // Create user message object
                const userMessage = {
                    id: crypto.randomUUID(),
                    content: suggestion,
                    timestamp: new Date(),
                    type: /** @type {'user'} */ ('user')
                };
                
                // Add message to chat
                addMessageToChat(userMessage);
                
                // Show typing indicator
                showTypingIndicator();
                
                // Clear suggestions
                clearSuggestions();
            });
            
            suggestionsContainer.appendChild(suggestionButton);
        }
    }
    
    /**
     * Clear all suggestions
     */
    function clearSuggestions() {
        suggestionsContainer.innerHTML = '';
    }
    
    /**
     * Show typing indicator in chat
     */
    function showTypingIndicator() {
        typingIndicator.classList.remove('hidden');
        scrollToBottom();
    }
    
    /**
     * Hide typing indicator
     */
    function hideTypingIndicator() {
        typingIndicator.classList.add('hidden');
    }
    
    /**
     * Scroll to the bottom of the chat container
     */
    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    /**
     * Update the active document information
     * @param {string} documentName 
     * @param {string} documentPath 
     */
    function updateActiveDocument(documentName, documentPath) {
        activeDocumentName = documentName;
        activeDocumentPath = documentPath;
        
        // Update document name in UI
        const documentNameElement = document.querySelector('.document-name');
        if (documentNameElement) {
            documentNameElement.textContent = documentName || 'No document selected';
        }
    }
    
    /**
     * Load conversation history
     * @param {Array<{id: string, content: string, timestamp: string|Date, type: 'user' | 'assistant', intent?: string, entities?: Array<{name: string, value: string, type: string}>, suggestions?: string[]}>} historyMessages 
     */
    function loadConversationHistory(historyMessages) {
        // Clear existing messages
        chatContainer.innerHTML = '';
        messages = [];
        
        // Add messages from history
        for (const message of historyMessages) {
            // Convert timestamp string to Date if needed
            const messageWithDateTimestamp = {
                ...message,
                timestamp: message.timestamp instanceof Date ? 
                    message.timestamp : 
                    new Date(message.timestamp)
            };
            
            addMessageToChat(messageWithDateTimestamp);
        }
    }
    
    /**
     * Clear the conversation history
     */
    function clearConversationHistory() {
        chatContainer.innerHTML = '';
        messages = [];
        clearSuggestions();
    }
    
    /**
     * Handle messages from the extension
     */
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'addMessage':
                // Hide typing indicator
                hideTypingIndicator();
                
                // Add message to chat
                addMessageToChat(message.message);
                break;
                
            case 'updateActiveDocument':
                updateActiveDocument(message.documentName, message.documentPath);
                break;
                
            case 'showTypingIndicator':
                showTypingIndicator();
                break;
                
            case 'hideTypingIndicator':
                hideTypingIndicator();
                break;
                
            case 'loadHistory':
                loadConversationHistory(message.messages);
                break;
                
            case 'clearHistory':
                clearConversationHistory();
                break;
                
            case 'updateSuggestions':
                updateSuggestions(message.suggestions);
                break;
        }
    });
    
    // Initialize the webview
    initialize();
}());
