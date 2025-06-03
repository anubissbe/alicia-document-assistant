import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { ConversationHistoryManager } from './conversationHistoryManager';
import { EntityExtractor, MessageIntent } from '../core/entityExtractor';
import { ContentSuggestionEngine } from '../core/contentSuggestionEngine';
import { FeedbackLearningEngine } from '../core/feedbackLearningEngine';
import { SentimentAnalyzer, SentimentResult } from '../core/sentimentAnalyzer';

/**
 * Get a nonce to use in HTML to avoid script injection attacks
 * @returns A random string for use in script nonce attribute
 */
function getNonce() {
    return crypto.randomBytes(16).toString('base64');
}

/**
 * Interface for assistant message
 */
export interface AssistantMessage {
    id: string;
    content: string;
    timestamp: Date;
    type: 'user' | 'assistant';
    intent?: MessageIntent;
    sentiment?: {
        score: number;
        label: 'positive' | 'negative' | 'neutral' | 'mixed';
    };
    entities?: Array<{
        name: string;
        value: string;
        type: string;
    }>;
    suggestions?: string[];
}

/**
 * DocumentAssistant provides a chat-based interface for helping users with documents
 */
export class DocumentAssistant {
    private _panel?: vscode.WebviewPanel;
    private _extensionUri: vscode.Uri;
    private _conversationHistory: ConversationHistoryManager;
    private _entityExtractor: EntityExtractor;
    private _contentSuggestionEngine: ContentSuggestionEngine;
    private _feedbackLearningEngine: FeedbackLearningEngine;
    private _sentimentAnalyzer: SentimentAnalyzer;
    private _activeDocumentUri?: vscode.Uri;
    
    /**
     * Constructor
     * @param extensionUri The URI of the extension
     */
    constructor(
        extensionUri: vscode.Uri, 
        conversationHistory: ConversationHistoryManager,
        entityExtractor: EntityExtractor,
        contentSuggestionEngine: ContentSuggestionEngine,
        feedbackLearningEngine: FeedbackLearningEngine,
        sentimentAnalyzer: SentimentAnalyzer
    ) {
        this._extensionUri = extensionUri;
        this._conversationHistory = conversationHistory;
        this._entityExtractor = entityExtractor;
        this._contentSuggestionEngine = contentSuggestionEngine;
        this._feedbackLearningEngine = feedbackLearningEngine;
        this._sentimentAnalyzer = sentimentAnalyzer;
        
        // Register commands
        this._registerCommands();
        
        // Listen for active editor changes
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this._activeDocumentUri = editor.document.uri;
                this._updateActiveDocument();
            }
        });
    }
    
    /**
     * Open the document assistant panel
     * @param documentUri Optional URI of the document to assist with
     */
    public open(documentUri?: vscode.Uri): void {
        // If a document URI is provided, set it as the active document
        if (documentUri) {
            this._activeDocumentUri = documentUri;
        }
        
        // If the panel already exists, reveal it
        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.Beside);
            return;
        }
        
        // Create the webview panel
        this._panel = vscode.window.createWebviewPanel(
            'documentWriter.documentAssistant',
            'Document Assistant',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'media'),
                    vscode.Uri.joinPath(this._extensionUri, 'resources')
                ]
            }
        );
        
        // Set the HTML content for the webview
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        
        // Set up the message listener
        this._setWebviewMessageListener(this._panel.webview);
        
        // Handle panel disposal
        this._panel.onDidDispose(() => {
            this._panel = undefined;
        }, null, []);
        
        // Send initial messages
        this._sendWelcomeMessage();
        this._updateActiveDocument();
    }
    
    /**
     * Register commands
     */
    private _registerCommands(): void {
        vscode.commands.registerCommand('documentWriter.openDocumentAssistant', () => {
            this.open();
        });
        
        vscode.commands.registerCommand('documentWriter.analyzeDocument', () => {
            if (vscode.window.activeTextEditor) {
                this.open(vscode.window.activeTextEditor.document.uri);
                this._analyzeCurrentDocument();
            } else {
                vscode.window.showErrorMessage('Please open a document first.');
            }
        });
        
        vscode.commands.registerCommand('documentWriter.exportConversationHistory', async () => {
            await this._exportConversationHistory();
        });
        
        vscode.commands.registerCommand('documentWriter.importConversationHistory', async () => {
            await this._importConversationHistory();
        });
        
        vscode.commands.registerCommand('documentWriter.clearConversationHistory', async () => {
            await this._clearConversationHistory();
        });
    }
    
    /**
     * Send a welcome message
     */
    private _sendWelcomeMessage(): void {
        if (!this._panel) return;
        
        const welcomeMessage: AssistantMessage = {
            id: crypto.randomUUID(),
            content: 'Hello! I\'m your document assistant. How can I help you with your document today?',
            timestamp: new Date(),
            type: 'assistant',
            suggestions: [
                'Analyze my document',
                'Suggest improvements',
                'Help me with formatting',
                'Create a new section'
            ]
        };
        
        this._panel.webview.postMessage({
            command: 'addMessage',
            message: welcomeMessage
        });
        
        // Save message to conversation history
        this._conversationHistory.addMessage(welcomeMessage);
    }
    
    /**
     * Update the active document info in the webview
     */
    private _updateActiveDocument(): void {
        if (!this._panel || !this._activeDocumentUri) return;
        
        const documentName = path.basename(this._activeDocumentUri.fsPath);
        
        this._panel.webview.postMessage({
            command: 'updateActiveDocument',
            documentName,
            documentPath: this._activeDocumentUri.fsPath
        });
    }
    
    /**
     * Analyze the current document
     */
    private async _analyzeCurrentDocument(): Promise<void> {
        if (!this._panel || !this._activeDocumentUri) return;
        
        try {
            // Get the document content
            const document = await vscode.workspace.openTextDocument(this._activeDocumentUri);
            const content = document.getText();
            const documentName = path.basename(this._activeDocumentUri.fsPath);
            
            // Create an analysis message
            const analysisMessage: AssistantMessage = {
                id: crypto.randomUUID(),
                content: `I'm analyzing ${documentName}. This may take a moment...`,
                timestamp: new Date(),
                type: 'assistant'
            };
            
            // Add the message to the UI
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: analysisMessage
            });
            
            // Save message to conversation history
            this._conversationHistory.addMessage(analysisMessage);
            
            // TODO: Implement actual document analysis
            // For now, we'll just simulate it with a timeout
            setTimeout(() => {
                if (!this._panel) return;
                
                // Create a sample analysis result
                const result: AssistantMessage = {
                    id: crypto.randomUUID(),
                    content: `
                        I've analyzed your document **${documentName}**. Here's what I found:
                        
                        - **Document Type**: ${this._detectDocumentType(content)}
                        - **Word Count**: ${this._countWords(content)} words
                        - **Reading Time**: ${Math.ceil(this._countWords(content) / 200)} minutes
                        - **Readability**: Good
                        
                        Would you like me to suggest any improvements to the document?
                    `,
                    timestamp: new Date(),
                    type: 'assistant',
                    suggestions: [
                        'Suggest improvements',
                        'Check grammar and spelling',
                        'Help me with citations',
                        'Generate a summary'
                    ]
                };
                
                // Add the message to the UI
                this._panel.webview.postMessage({
                    command: 'addMessage',
                    message: result
                });
                
                // Save message to conversation history
                this._conversationHistory.addMessage(result);
            }, 1500);
        } catch (error) {
            console.error('Error analyzing document:', error);
            vscode.window.showErrorMessage('Error analyzing document');
        }
    }
    
    /**
     * Count the number of words in a text
     * @param text The text to count words in
     * @returns The number of words
     */
    private _countWords(text: string): number {
        return text.split(/\s+/).filter(word => word.length > 0).length;
    }
    
    /**
     * Detect the document type based on content
     * @param content The document content
     * @returns The detected document type
     */
    private _detectDocumentType(content: string): string {
        // This is a very simplistic detection - in reality, this would be more sophisticated
        if (content.toLowerCase().includes('dear ') && content.toLowerCase().includes('sincerely')) {
            return 'Letter';
        } else if (content.toLowerCase().includes('abstract') && content.toLowerCase().includes('references')) {
            return 'Academic Paper';
        } else if (content.toLowerCase().includes('executive summary')) {
            return 'Business Report';
        } else if (content.toLowerCase().includes('# ') || content.toLowerCase().includes('## ')) {
            return 'Markdown Document';
        } else {
            return 'General Document';
        }
    }
    
    /**
     * Process a user message
     * @param message The user message
     */
    private async _processUserMessage(message: string): Promise<void> {
        if (!this._panel) return;
        
        // Create a user message object
        const userMessage: AssistantMessage = {
            id: crypto.randomUUID(),
            content: message,
            timestamp: new Date(),
            type: 'user'
        };
        
        // Add the message to the UI first so it appears immediately
        this._panel.webview.postMessage({
            command: 'addMessage',
            message: userMessage
        });
        
        // Save to conversation history
        this._conversationHistory.addMessage(userMessage);
        
        // Analyze sentiment
        const sentiment = this._sentimentAnalyzer.analyzeSentiment(message);
        userMessage.sentiment = {
            score: sentiment.score,
            label: sentiment.label
        };
        
        // Extract intent and entities
        const intent = await this._entityExtractor.extractIntent(message);
        const entities = await this._entityExtractor.extractSimplifiedEntities(message);
        
        userMessage.intent = intent;
        userMessage.entities = entities;
        
        // Show typing indicator
        this._panel.webview.postMessage({
            command: 'showTypingIndicator'
        });
        
        // Process based on intent
        switch(intent) {
            case 'analyze_document':
                this._analyzeCurrentDocument();
                break;
                
            case 'suggest_improvements':
                this._suggestImprovements();
                break;
                
            case 'help_formatting':
                this._provideFormattingHelp();
                break;
                
            case 'create_section':
                this._suggestNewSection();
                break;
                
            case 'general_question':
            default:
                this._respondToGeneralQuestion(message, entities);
                break;
        }
    }
    
    /**
     * Respond to a general question
     * @param message The user message
     * @param entities Extracted entities
     */
    /**
     * Convert history messages from ConversationHistoryManager format to ContentSuggestionEngine format
     * @param historyMessages Array of history messages from ConversationHistoryManager
     * @returns Array of history messages compatible with ContentSuggestionEngine
     */
    private _convertToContentSuggestionHistoryMessages(historyMessages: {role: 'user' | 'assistant', content: string}[]): {
        content: string;
        sender: 'user' | 'assistant' | 'system';
        timestamp: number;
        intent?: MessageIntent;
    }[] {
        return historyMessages.map(message => ({
            content: message.content,
            sender: message.role,
            timestamp: Date.now(),
            intent: undefined
        }));
    }
    
    private async _respondToGeneralQuestion(message: string, entities?: Array<{name: string, value: string, type: string}>): Promise<void> {
        if (!this._panel) return;
        
        // Show typing indicator
        this._panel.webview.postMessage({
            command: 'showTypingIndicator'
        });
        
        try {
            // Generate a response using the content suggestion engine
            const messages = this._conversationHistory.getMessages().slice(-5);
            const historyMessages = this._conversationHistory.convertToHistoryMessages(messages);
            const contentSuggestionHistory = this._convertToContentSuggestionHistoryMessages(historyMessages);
            const response = await this._contentSuggestionEngine.generateResponse(message, contentSuggestionHistory, entities);
            
            // Generate suggestions based on the conversation context
            const suggestions = await this._contentSuggestionEngine.generateSuggestions(message, contentSuggestionHistory);
            
            // Create a response message
            const responseMessage: AssistantMessage = {
                id: crypto.randomUUID(),
                content: response,
                timestamp: new Date(),
                type: 'assistant',
                suggestions
            };
            
            // Hide typing indicator and add the message
            this._panel.webview.postMessage({
                command: 'hideTypingIndicator'
            });
            
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: responseMessage
            });
            
            // Save to conversation history
            this._conversationHistory.addMessage(responseMessage);
            
            // Learn from this interaction to improve future responses
            this._feedbackLearningEngine.learnFromInteraction(message, response);
        } catch (error) {
            console.error('Error generating response:', error);
            
            // Hide typing indicator
            this._panel.webview.postMessage({
                command: 'hideTypingIndicator'
            });
            
            // Send error message
            const errorMessage: AssistantMessage = {
                id: crypto.randomUUID(),
                content: 'I apologize, but I encountered an error while processing your request. Please try again.',
                timestamp: new Date(),
                type: 'assistant'
            };
            
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: errorMessage
            });
            
            // Save to conversation history
            this._conversationHistory.addMessage(errorMessage);
        }
    }
    
    /**
     * Suggest improvements for the current document
     */
    private _suggestImprovements(): void {
        // This would be implemented with actual document analysis
        if (!this._panel) return;
        
        // Show typing indicator
        this._panel.webview.postMessage({
            command: 'showTypingIndicator'
        });
        
        // Simulate processing time
        setTimeout(() => {
            if (!this._panel) return;
            
            // Hide typing indicator
            this._panel.webview.postMessage({
                command: 'hideTypingIndicator'
            });
            
            const improvementsMessage: AssistantMessage = {
                id: crypto.randomUUID(),
                content: `
                    Based on my analysis, here are some suggested improvements:
                    
                    1. **Add a clear introduction** at the beginning to set the context
                    2. **Break up long paragraphs** to improve readability
                    3. **Use more headings** to structure your document
                    4. **Add a conclusion section** to summarize key points
                    
                    Would you like me to help implement any of these suggestions?
                `,
                timestamp: new Date(),
                type: 'assistant',
                suggestions: [
                    'Help me with the introduction',
                    'Show me how to structure headings',
                    'Create a conclusion section',
                    'No thanks, I will do it myself'
                ]
            };
            
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: improvementsMessage
            });
            
            // Save to conversation history
            this._conversationHistory.addMessage(improvementsMessage);
        }, 1500);
    }
    
    /**
     * Provide help with formatting
     */
    private _provideFormattingHelp(): void {
        if (!this._panel) return;
        
        // Show typing indicator
        this._panel.webview.postMessage({
            command: 'showTypingIndicator'
        });
        
        // Simulate processing time
        setTimeout(() => {
            if (!this._panel) return;
            
            // Hide typing indicator
            this._panel.webview.postMessage({
                command: 'hideTypingIndicator'
            });
            
            const formattingMessage: AssistantMessage = {
                id: crypto.randomUUID(),
                content: `
                    Here are some formatting tips for your document:
                    
                    ## Headings
                    - Use # for main headings
                    - Use ## for subheadings
                    - Use ### for sub-subheadings
                    
                    ## Emphasis
                    - Use *italic* or _italic_ for italic text
                    - Use **bold** or __bold__ for bold text
                    
                    ## Lists
                    - Use - or * for bullet points
                    - Use 1. 2. 3. for numbered lists
                    
                    ## Links
                    - Use [link text](URL) for links
                    
                    What specific formatting would you like help with?
                `,
                timestamp: new Date(),
                type: 'assistant',
                suggestions: [
                    'Help me with tables',
                    'How do I add images?',
                    'Show me code block formatting',
                    'How to create a table of contents'
                ]
            };
            
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: formattingMessage
            });
            
            // Save to conversation history
            this._conversationHistory.addMessage(formattingMessage);
        }, 1000);
    }
    
    /**
     * Suggest a new section for the document
     */
    private _suggestNewSection(): void {
        if (!this._panel) return;
        
        // Show typing indicator
        this._panel.webview.postMessage({
            command: 'showTypingIndicator'
        });
        
        // Simulate processing time
        setTimeout(() => {
            if (!this._panel) return;
            
            // Hide typing indicator
            this._panel.webview.postMessage({
                command: 'hideTypingIndicator'
            });
            
            const sectionMessage: AssistantMessage = {
                id: crypto.randomUUID(),
                content: `
                    Based on your document, I suggest adding the following section:
                    
                    ## Methodology
                    
                    In this section, you should describe:
                    
                    1. The approach you took to solve the problem
                    2. Any tools or techniques you used
                    3. The steps you followed in your process
                    4. How you evaluated your results
                    
                    Would you like me to generate a draft of this section for you?
                `,
                timestamp: new Date(),
                type: 'assistant',
                suggestions: [
                    'Yes, generate a draft',
                    'Suggest a different section',
                    'Show me a template',
                    'No thanks'
                ]
            };
            
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: sectionMessage
            });
            
            // Save to conversation history
            this._conversationHistory.addMessage(sectionMessage);
        }, 1200);
    }
    
    /**
     * Get the HTML for the webview
     * @param webview The webview
     * @returns The HTML string
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Create URIs for scripts and styles
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'documentAssistant.js')
        );
        
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'documentAssistant.css')
        );
        
        // Use a nonce to whitelist which scripts can be run
        const nonce = getNonce();
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Document Assistant</title>
        </head>
        <body>
            <div class="assistant-container">
                <div class="document-info">
                    <div class="document-info-header">
                        <h2>Document Assistant</h2>
                        <div class="document-name">No document selected</div>
                    </div>
                </div>
                
                <div class="chat-container">
                    <div class="messages" id="messages"></div>
                    
                    <div class="typing-indicator hidden">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    
                    <div class="suggestions-container" id="suggestions-container"></div>
                    
                    <div class="input-container">
                        <textarea id="message-input" placeholder="Ask me something about your document..."></textarea>
                        <button id="send-button" class="send-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
    
    /**
     * Set up the webview message listener
     * @param webview The webview
     */
    private _setWebviewMessageListener(webview: vscode.Webview): void {
        webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'sendMessage':
                        // Process the user message
                        this._processUserMessage(message.text);
                        break;
                        
                    case 'suggestionSelected':
                        // Process the selected suggestion as a user message
                        this._processUserMessage(message.text);
                        break;
                        
                    case 'applyChanges':
                        // Apply suggested changes to the document
                        this._applyChangesToDocument(message.changes);
                        break;
                        
                    case 'insertSection':
                        // Insert a new section into the document
                        this._insertSectionIntoDocument(message.section);
                        break;
                        
                    case 'requestHistory':
                        // Send conversation history to the webview
                        const history = this._conversationHistory.getMessages();
                        webview.postMessage({
                            command: 'loadHistory',
                            messages: history
                        });
                        break;
                }
            },
            undefined,
            []
        );
    }
    
    /**
     * Apply changes to the active document
     * @param changes The changes to apply
     */
    private async _applyChangesToDocument(changes: {range: {start: {line: number, character: number}, end: {line: number, character: number}}, text: string}[]): Promise<void> {
        if (!this._activeDocumentUri) {
            vscode.window.showErrorMessage('No active document to apply changes to');
            return;
        }
        
        try {
            const document = await vscode.workspace.openTextDocument(this._activeDocumentUri);
            const edit = new vscode.WorkspaceEdit();
            
            for (const change of changes) {
                const range = new vscode.Range(
                    new vscode.Position(change.range.start.line, change.range.start.character),
                    new vscode.Position(change.range.end.line, change.range.end.character)
                );
                
                edit.replace(this._activeDocumentUri, range, change.text);
            }
            
            await vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage('Changes applied successfully');
        } catch (error) {
            console.error('Error applying changes:', error);
            vscode.window.showErrorMessage('Error applying changes to document');
        }
    }
    
    /**
     * Insert a section into the active document
     * @param section The section to insert
     */
    private async _insertSectionIntoDocument(section: {title: string, content: string, position?: number}): Promise<void> {
        if (!this._activeDocumentUri) {
            vscode.window.showErrorMessage('No active document to insert section into');
            return;
        }
        
        try {
            const document = await vscode.workspace.openTextDocument(this._activeDocumentUri);
            const edit = new vscode.WorkspaceEdit();
            
            // Determine the position to insert the section
            let position: vscode.Position;
            
            if (section.position !== undefined) {
                // Insert at the specified position
                position = new vscode.Position(section.position, 0);
            } else {
                // Insert at the end of the document
                const lastLine = document.lineCount - 1;
                const lastLineText = document.lineAt(lastLine).text;
                position = new vscode.Position(
                    lastLine + (lastLineText.trim() === '' ? 0 : 1),
                    0
                );
            }
            
            // Format the section content
            const sectionContent = `## ${section.title}\n\n${section.content}\n\n`;
            
            // Apply the edit
            edit.insert(this._activeDocumentUri, position, sectionContent);
            await vscode.workspace.applyEdit(edit);
            
            vscode.window.showInformationMessage(`Section "${section.title}" inserted successfully`);
        } catch (error) {
            console.error('Error inserting section:', error);
            vscode.window.showErrorMessage('Error inserting section into document');
        }
    }
    
    /**
     * Export conversation history to a JSON file
     */
    private async _exportConversationHistory(): Promise<void> {
        try {
            // Get conversation history
            const history = this._conversationHistory.getMessages();
            
            if (history.length === 0) {
                vscode.window.showInformationMessage('No conversation history to export');
                return;
            }
            
            // Ask user for export location
            const fileUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('conversation_history.json'),
                filters: {
                    'JSON Files': ['json']
                },
                title: 'Export Conversation History'
            });
            
            if (!fileUri) {
                return; // User cancelled
            }
            
            // Format the history for export
            const exportData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                messages: history
            };
            
            // Convert to JSON
            const jsonData = JSON.stringify(exportData, null, 2);
            
            // Write to file
            const writeData = Buffer.from(jsonData, 'utf8');
            await vscode.workspace.fs.writeFile(fileUri, writeData);
            
            vscode.window.showInformationMessage(`Conversation history exported to ${fileUri.fsPath}`);
        } catch (error) {
            console.error('Error exporting conversation history:', error);
            vscode.window.showErrorMessage('Error exporting conversation history');
        }
    }
    
    /**
     * Import conversation history from a JSON file
     */
    private async _importConversationHistory(): Promise<void> {
        try {
            // Ask user for import file
            const fileUris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    'JSON Files': ['json']
                },
                title: 'Import Conversation History'
            });
            
            if (!fileUris || fileUris.length === 0) {
                return; // User cancelled
            }
            
            // Read the file
            const fileUri = fileUris[0];
            const readData = await vscode.workspace.fs.readFile(fileUri);
            const jsonData = Buffer.from(readData).toString('utf8');
            
            // Parse the JSON
            const importData = JSON.parse(jsonData);
            
            // Validate the import data
            if (!importData.messages || !Array.isArray(importData.messages)) {
                throw new Error('Invalid conversation history format');
            }
            
            // Confirm with user before overwriting current history
            const currentHistory = this._conversationHistory.getMessages();
            if (currentHistory.length > 0) {
                const confirmation = await vscode.window.showWarningMessage(
                    'Importing will replace your current conversation history. Continue?',
                    { modal: true },
                    'Import',
                    'Cancel'
                );
                
                if (confirmation !== 'Import') {
                    return; // User cancelled
                }
                
                // Clear existing history
                this._conversationHistory.clearHistory();
            }
            
            // Process the imported messages
            for (const message of importData.messages) {
                // Convert string timestamps back to Date objects
                if (typeof message.timestamp === 'string') {
                    message.timestamp = new Date(message.timestamp);
                }
                
                // Add to conversation history
                this._conversationHistory.addMessage(message);
            }
            
            vscode.window.showInformationMessage(`Imported ${importData.messages.length} messages from ${fileUri.fsPath}`);
            
            // If panel is open, update it with the imported history
            if (this._panel) {
                const history = this._conversationHistory.getMessages();
                this._panel.webview.postMessage({
                    command: 'loadHistory',
                    messages: history
                });
            }
        } catch (error) {
            console.error('Error importing conversation history:', error);
            vscode.window.showErrorMessage(`Error importing conversation history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Clear the conversation history
     */
    private async _clearConversationHistory(): Promise<void> {
        try {
            // Confirm with user before clearing
            const confirmation = await vscode.window.showWarningMessage(
                'Are you sure you want to clear all conversation history?',
                { modal: true },
                'Clear',
                'Cancel'
            );
            
            if (confirmation !== 'Clear') {
                return; // User cancelled
            }
            
            // Clear history
            this._conversationHistory.clearHistory();
            
            // Update UI if panel is open
            if (this._panel) {
                this._panel.webview.postMessage({
                    command: 'clearHistory'
                });
                
                // Send welcome message again
                this._sendWelcomeMessage();
            }
            
            vscode.window.showInformationMessage('Conversation history cleared');
        } catch (error) {
            console.error('Error clearing conversation history:', error);
            vscode.window.showErrorMessage('Error clearing conversation history');
        }
    }
}
