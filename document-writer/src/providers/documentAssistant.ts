import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { ConversationHistoryManager } from './conversationHistoryManager';
import { EntityExtractor, MessageIntent } from '../core/entityExtractor';
import { ContentSuggestionEngine } from '../core/contentSuggestionEngine';
import { FeedbackLearningEngine } from '../core/feedbackLearningEngine';
import { SentimentAnalyzer, SentimentResult } from '../core/sentimentAnalyzer';
import { DocumentAnalyzer, AnalysisResult } from '../core/documentAnalyzer';
import { DocumentFormat } from '../models/documentFormat';
import { DocumentPreviewProvider } from './documentPreviewProvider';
import { DocumentFormatConverter } from '../utils/documentFormatConverter';

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
            
            // Determine document format based on file extension
            let format = DocumentFormat.TEXT; // Changed from PLAIN_TEXT to TEXT to match the enum
            const extension = path.extname(documentName).toLowerCase();
            
            if (extension === '.md') {
                format = DocumentFormat.MARKDOWN;
            } else if (extension === '.html' || extension === '.htm') {
                format = DocumentFormat.HTML;
            } else if (extension === '.docx') {
                format = DocumentFormat.DOCX;
            } else if (extension === '.pdf') {
                format = DocumentFormat.PDF;
            }
            
            // Create DocumentAnalyzer instance
            const documentAnalyzer = new DocumentAnalyzer();
            
            // Perform the analysis
            const analysisResult = await documentAnalyzer.analyzeDocument(content);
            
            // Format the analysis result as a message
            let analysisContent = `
                ## Analysis of ${documentName}
                
                ### Document Overview
                - **Document Type**: ${analysisResult.documentType}
                - **Word Count**: ${analysisResult.wordCount} words
                - **Reading Time**: ${analysisResult.readingTime} minutes
                - **Readability**: ${analysisResult.readabilityLevel} (score: ${analysisResult.readabilityScore}/100)
                
                ### Structure
                - **Sections**: ${analysisResult.structure.hasSections ? `Yes (${analysisResult.structure.sectionCount})` : 'No'}
                - **Paragraphs**: ${analysisResult.statistics.paragraphCount}
                - **Sentences**: ${analysisResult.statistics.sentenceCount}
                - **Average Sentence Length**: ${analysisResult.statistics.averageSentenceLength.toFixed(1)} words
            `;
            
            // Add sentiment analysis if available
            if (analysisResult.sentimentScore !== undefined && analysisResult.sentimentLabel !== undefined) {
                analysisContent += `
                
                ### Sentiment
                - **Overall Tone**: ${analysisResult.sentimentLabel.charAt(0).toUpperCase() + analysisResult.sentimentLabel.slice(1)}
                - **Sentiment Score**: ${analysisResult.sentimentScore.toFixed(2)}
                `;
            }
            
            // Add key topics
            if (analysisResult.keyTopics.length > 0) {
                analysisContent += `
                
                ### Key Topics
                - ${analysisResult.keyTopics.join('\n- ')}
                `;
            }
            
            // Add suggestions if available
            if (analysisResult.suggestions.length > 0) {
                analysisContent += `
                
                ### Suggestions for Improvement
                - ${analysisResult.suggestions.join('\n- ')}
                `;
            }
            
            // Create the final message
            const result: AssistantMessage = {
                id: crypto.randomUUID(),
                content: analysisContent,
                timestamp: new Date(),
                type: 'assistant',
                suggestions: [
                    'Suggest improvements',
                    'Check grammar and spelling',
                    'Help me with the document structure',
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
        } catch (error) {
            console.error('Error analyzing document:', error);
            vscode.window.showErrorMessage('Error analyzing document');
            
            if (this._panel) {
                // Send error message to the chat
                const errorMessage: AssistantMessage = {
                    id: crypto.randomUUID(),
                    content: 'I encountered an error while analyzing your document. Please try again or check the document format.',
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
     * Get a basic intent from message text using simple keyword matching
     * @param message The message text to analyze
     * @returns The detected intent or undefined
     */
    private _getBasicIntent(message: string): MessageIntent | undefined {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('analyze') || lowerMessage.includes('check') || lowerMessage.includes('review')) {
            return 'analyze_document';
        } else if (lowerMessage.includes('improve') || lowerMessage.includes('suggestion') || lowerMessage.includes('better')) {
            return 'suggest_improvements';
        } else if (lowerMessage.includes('format') || lowerMessage.includes('style') || lowerMessage.includes('layout')) {
            return 'help_formatting';
        } else if (lowerMessage.includes('section') || lowerMessage.includes('create') || lowerMessage.includes('add')) {
            return 'create_section';
        } else {
            return 'general_question';
        }
    }
    
    /**
     * Export the document to a specified format
     * @param format The target format
     */
    private async _exportDocument(format: string): Promise<void> {
        if (!this._panel || !this._activeDocumentUri) {
            return;
        }
        
        try {
            // Show typing indicator
            this._panel.webview.postMessage({
                command: 'showTypingIndicator'
            });
            
            // Get preview provider
            const previewProvider = DocumentPreviewProvider.getProvider();
            
            if (!previewProvider) {
                throw new Error('Preview provider is not available');
            }
            
            // Use the preview provider's export functionality
            vscode.commands.executeCommand('document-writer.exportDocument', format);
            
            // Hide typing indicator
            this._panel.webview.postMessage({
                command: 'hideTypingIndicator'
            });
            
            // Create response message
            const exportMessage: AssistantMessage = {
                id: crypto.randomUUID(),
                content: `I've initiated the export process for your document to ${format} format. Please select a location to save the exported file.`,
                timestamp: new Date(),
                type: 'assistant',
                suggestions: [
                    'Show document preview',
                    'Export to another format',
                    'Analyze document'
                ]
            };
            
            // Send the message
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: exportMessage
            });
            
            // Save to conversation history
            this._conversationHistory.addMessage(exportMessage);
        } catch (error) {
            console.error('Error exporting document:', error);
            
            if (this._panel) {
                // Hide typing indicator
                this._panel.webview.postMessage({
                    command: 'hideTypingIndicator'
                });
                
                // Send error message
                const errorMessage: AssistantMessage = {
                    id: crypto.randomUUID(),
                    content: `I'm sorry, but I encountered an error while exporting the document: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    }
    
    /**
     * Print the current document
     */
    private async _printDocument(): Promise<void> {
        if (!this._panel || !this._activeDocumentUri) {
            return;
        }
        
        try {
            // Show typing indicator
            this._panel.webview.postMessage({
                command: 'showTypingIndicator'
            });
            
            // Get preview provider
            const previewProvider = DocumentPreviewProvider.getProvider();
            
            if (!previewProvider) {
                throw new Error('Preview provider is not available');
            }
            
            // Use the preview provider's print functionality
            vscode.commands.executeCommand('document-writer.printDocument');
            
            // Hide typing indicator
            this._panel.webview.postMessage({
                command: 'hideTypingIndicator'
            });
            
            // Create response message
            const printMessage: AssistantMessage = {
                id: crypto.randomUUID(),
                content: 'I\'ve sent your document to the printer. Please check your system print dialog.',
                timestamp: new Date(),
                type: 'assistant'
            };
            
            // Send the message
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: printMessage
            });
            
            // Save to conversation history
            this._conversationHistory.addMessage(printMessage);
        } catch (error) {
            console.error('Error printing document:', error);
            
            if (this._panel) {
                // Hide typing indicator
                this._panel.webview.postMessage({
                    command: 'hideTypingIndicator'
                });
                
                // Send error message
                const errorMessage: AssistantMessage = {
                    id: crypto.randomUUID(),
                    content: `I'm sorry, but I encountered an error while trying to print the document: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    }
    
    /**
     * Show document preview in chat
     * @param format Optional target format for the preview
     */
    private async _showDocumentPreview(format?: DocumentFormat): Promise<void> {
        if (!this._panel || !this._activeDocumentUri) {
            return;
        }
        
        try {
            // Get the document content
            const document = await vscode.workspace.openTextDocument(this._activeDocumentUri);
            const content = document.getText();
            const documentName = path.basename(this._activeDocumentUri.fsPath);
            
            // Show typing indicator
            this._panel.webview.postMessage({
                command: 'showTypingIndicator'
            });
            
            // Get preview provider
            const previewProvider = DocumentPreviewProvider.getProvider();
            
            if (!previewProvider) {
                throw new Error('Preview provider is not available');
            }
            
            // Determine source format based on file extension
            let sourceFormat = DocumentFormat.TEXT;
            const extension = path.extname(documentName).toLowerCase();
            
            if (extension === '.md') {
                sourceFormat = DocumentFormat.MARKDOWN;
            } else if (extension === '.html' || extension === '.htm') {
                sourceFormat = DocumentFormat.HTML;
            } else if (extension === '.docx') {
                sourceFormat = DocumentFormat.DOCX;
            } else if (extension === '.pdf') {
                sourceFormat = DocumentFormat.PDF;
            }
            
            // Set target format (default to HTML if not specified)
            const targetFormat = format || DocumentFormat.HTML;
            
            // Create a converter
            const converter = new DocumentFormatConverter();
            
            // Generate preview content
            const previewContent = await converter.generatePreview(
                content,
                sourceFormat,
                {
                    targetFormat,
                    preview: {
                        interactive: true,
                        renderMath: true,
                        renderDiagrams: true,
                        highlightSyntax: true,
                        showAnnotations: true
                    },
                    preserveFormatting: true,
                    includeStyles: true
                }
            );
            
            // Create a response message with the preview
            let responseContent = `## Preview of ${documentName}\n\n`;
            
            if (targetFormat === DocumentFormat.HTML) {
                // For HTML, embed a snippet of the HTML preview
                const htmlSnippet = previewContent.length > 500 
                    ? previewContent.substring(0, 500) + '...' 
                    : previewContent;
                
                responseContent += `
                    A preview of your document has been generated in HTML format.
                    
                    \`\`\`html
                    ${htmlSnippet}
                    \`\`\`
                    
                    I've also opened the document in the preview panel for better viewing.
                `;
                
                // Update the preview panel
                vscode.commands.executeCommand('document-writer.refreshPreview');
            } else {
                // For other formats, include the preview content directly
                responseContent += previewContent;
            }
            
            // Hide typing indicator
            this._panel.webview.postMessage({
                command: 'hideTypingIndicator'
            });
            
            // Create response message
            const previewMessage: AssistantMessage = {
                id: crypto.randomUUID(),
                content: responseContent,
                timestamp: new Date(),
                type: 'assistant',
                suggestions: [
                    'Export as PDF',
                    'Export as DOCX',
                    'Show in Markdown format',
                    'Print document'
                ]
            };
            
            // Send the message
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: previewMessage
            });
            
            // Save to conversation history
            this._conversationHistory.addMessage(previewMessage);
        } catch (error) {
            console.error('Error generating preview:', error);
            
            if (this._panel) {
                // Hide typing indicator
                this._panel.webview.postMessage({
                    command: 'hideTypingIndicator'
                });
                
                // Send error message
                const errorMessage: AssistantMessage = {
                    id: crypto.randomUUID(),
                    content: `I'm sorry, but I encountered an error while generating the preview: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        return historyMessages.map((message, index) => ({
            content: message.content,
            sender: message.role,
            // Use incrementing timestamps to preserve message order
            timestamp: Date.now() - (historyMessages.length - index) * 1000,
            // Try to determine basic intent for user messages
            intent: message.role === 'user' ? 
                this._getBasicIntent(message.content) : 
                undefined
        }));
    }
    
    private async _respondToGeneralQuestion(message: string, entities?: Array<{name: string, value: string, type: string}>): Promise<void> {
        if (!this._panel) return;
        
        // Show typing indicator
        this._panel.webview.postMessage({
            command: 'showTypingIndicator'
        });
        
        try {
            // Analyze message sentiment
            const sentiment = this._sentimentAnalyzer.analyzeSentiment(message);
            
            // Generate a response using the content suggestion engine
            const messages = this._conversationHistory.getMessages().slice(-5);
            const historyMessages = this._conversationHistory.convertToHistoryMessages(messages);
            const contentSuggestionHistory = this._convertToContentSuggestionHistoryMessages(historyMessages);
            
            // Add sentiment context to improve response generation
            let sentimentContext = '';
            if (sentiment.label === 'negative' && sentiment.score < -0.5) {
                sentimentContext = 'The user seems frustrated or concerned. Be empathetic and provide clear, helpful information.';
            } else if (sentiment.label === 'positive' && sentiment.score > 0.5) {
                sentimentContext = 'The user seems enthusiastic. Match their positive tone while providing information.';
            } else if (sentiment.label === 'mixed') {
                sentimentContext = 'The user has mixed feelings. Address their concerns while highlighting positive aspects.';
            }
            
            // Generate response with sentiment context
            // We need to pass entities directly as the third parameter
            const response = await this._contentSuggestionEngine.generateResponse(
                message, 
                contentSuggestionHistory, 
                entities || [] // Pass entities directly
            );
            
            // If we have sentiment context, we can use it to adjust the response or learn from it
            if (sentimentContext) {
                console.log(`Using sentiment context: ${sentimentContext}`);
                // In a full implementation, we might use this for feedback learning
            }
            
            // Adapt suggestions based on sentiment
            let suggestions: string[] = [];
            
            if (sentiment.label === 'negative') {
                // For negative sentiment, focus on supportive and problem-solving suggestions
                suggestions = [
                    'Show me how to fix this issue',
                    'What are best practices for this?',
                    'Can you explain this in simpler terms?',
                    'Let me see an example'
                ];
            } else if (sentiment.label === 'positive') {
                // For positive sentiment, focus on exploration and enhancement
                suggestions = [
                    'What else can I improve?',
                    'Show me advanced techniques',
                    'How can I make this even better?',
                    'What are other options?'
                ];
            } else {
                // For neutral or mixed sentiment, generate general suggestions
                suggestions = await this._contentSuggestionEngine.generateSuggestions(
                    message, 
                    contentSuggestionHistory
                );
            }
            
            // Create a response message with sentiment information
            const responseMessage: AssistantMessage = {
                id: crypto.randomUUID(),
                content: response,
                timestamp: new Date(),
                type: 'assistant',
                sentiment: {
                    score: sentiment.score,
                    label: sentiment.label
                },
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
            // Store additional context for learning
            const feedbackContext = {
                userSentiment: sentiment.score,
                hasActiveDocument: !!this._activeDocumentUri,
                documentType: this._activeDocumentUri ? 
                    path.extname(this._activeDocumentUri.fsPath).toLowerCase() : 
                    undefined
            };
            
            this._feedbackLearningEngine.learnFromInteraction(
                message, 
                response, 
                sentiment.score // Use the sentiment score as the numeric feedback value
            );
            
            // If user sentiment is very negative, offer additional help
            if (sentiment.label === 'negative' && sentiment.score < -0.7) {
                setTimeout(() => {
                    if (!this._panel) return;
                    
                    const followUpMessage: AssistantMessage = {
                        id: crypto.randomUUID(),
                        content: "I notice you might be experiencing some difficulty. Is there something specific about the document you're struggling with that I can help clarify or explain better?",
                        timestamp: new Date(),
                        type: 'assistant',
                        suggestions: [
                            'Show me documentation',
                            'Walk me through this step by step',
                            'Show me an example',
                            'No thanks, I\'m fine'
                        ]
                    };
                    
                    this._panel.webview.postMessage({
                        command: 'addMessage',
                        message: followUpMessage
                    });
                    
                    // Save to conversation history
                    this._conversationHistory.addMessage(followUpMessage);
                }, 3000);
            }
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
    private async _suggestImprovements(): Promise<void> {
        if (!this._panel || !this._activeDocumentUri) {
            if (this._panel) {
                const noDocumentMessage: AssistantMessage = {
                    id: crypto.randomUUID(),
                    content: "I don't see an active document to analyze. Please open a document first or let me know which document you'd like me to help with.",
                    timestamp: new Date(),
                    type: 'assistant'
                };
                
                this._panel.webview.postMessage({
                    command: 'addMessage',
                    message: noDocumentMessage
                });
                
                this._conversationHistory.addMessage(noDocumentMessage);
            }
            return;
        }
        
        // Show typing indicator
        this._panel.webview.postMessage({
            command: 'showTypingIndicator'
        });
        
        try {
            // Get the document content
            const document = await vscode.workspace.openTextDocument(this._activeDocumentUri);
            const content = document.getText();
            const documentName = path.basename(this._activeDocumentUri.fsPath);
            
            // Determine document format based on file extension
            let format = DocumentFormat.TEXT;
            const extension = path.extname(documentName).toLowerCase();
            
            if (extension === '.md') {
                format = DocumentFormat.MARKDOWN;
            } else if (extension === '.html' || extension === '.htm') {
                format = DocumentFormat.HTML;
            } else if (extension === '.docx') {
                format = DocumentFormat.DOCX;
            } else if (extension === '.pdf') {
                format = DocumentFormat.PDF;
            }
            
            // Create DocumentAnalyzer instance
            const documentAnalyzer = new DocumentAnalyzer();
            
            // Perform the analysis
            const analysisResult = await documentAnalyzer.analyzeDocument(content);
            
            // Generate dynamic improvement suggestions based on analysis
            let improvementContent = `## Suggested Improvements for ${documentName}\n\n`;
            
            // Add improvement suggestions based on document type and analysis results
            if (analysisResult.suggestions.length > 0) {
                improvementContent += `### Key Recommendations\n`;
                analysisResult.suggestions.forEach((suggestion, index) => {
                    improvementContent += `${index + 1}. **${suggestion}**\n`;
                });
                improvementContent += '\n';
            }
            
            // Add readability suggestions
            if (analysisResult.readabilityLevel === 'Hard') {
                improvementContent += `### Readability Improvements\n`;
                improvementContent += `- Your document has a complex readability level (score: ${analysisResult.readabilityScore}/100)\n`;
                improvementContent += `- Consider simplifying language and using shorter sentences\n`;
                improvementContent += `- Break complex ideas into smaller, more digestible points\n\n`;
            }
            
            // Add structure suggestions
            if (!analysisResult.structure.hasSections || analysisResult.structure.sectionCount < 3) {
                improvementContent += `### Structure Improvements\n`;
                improvementContent += `- Your document ${!analysisResult.structure.hasSections ? 'lacks clear sections' : 'has only ' + analysisResult.structure.sectionCount + ' sections'}\n`;
                improvementContent += `- Consider adding ${!analysisResult.structure.hasSections ? 'section headings' : 'more section headings'} to organize your content\n`;
                
                // Suggest missing sections based on document type
                if (analysisResult.documentType === 'Academic Paper') {
                    const existingSections = analysisResult.structure.sectionTitles.map(title => title.toLowerCase());
                    const recommendedSections = ['abstract', 'introduction', 'methodology', 'results', 'discussion', 'conclusion', 'references'];
                    const missingSections = recommendedSections.filter(section => !existingSections.some(title => title.includes(section)));
                    
                    if (missingSections.length > 0) {
                        improvementContent += `- Consider adding these standard sections: **${missingSections.join(', ')}**\n`;
                    }
                } else if (analysisResult.documentType === 'Business Report') {
                    const existingSections = analysisResult.structure.sectionTitles.map(title => title.toLowerCase());
                    const recommendedSections = ['executive summary', 'introduction', 'findings', 'recommendations', 'conclusion'];
                    const missingSections = recommendedSections.filter(section => !existingSections.some(title => title.includes(section)));
                    
                    if (missingSections.length > 0) {
                        improvementContent += `- Consider adding these standard sections: **${missingSections.join(', ')}**\n`;
                    }
                }
                improvementContent += '\n';
            }
            
            // Add statistical suggestions
            if (analysisResult.statistics.averageSentenceLength > 25 || analysisResult.statistics.longSentences > 3) {
                improvementContent += `### Sentence Structure Improvements\n`;
                if (analysisResult.statistics.averageSentenceLength > 25) {
                    improvementContent += `- Your average sentence length is ${analysisResult.statistics.averageSentenceLength.toFixed(1)} words (ideal: 15-20 words)\n`;
                    improvementContent += `- Consider breaking long sentences into shorter ones\n`;
                }
                if (analysisResult.statistics.longSentences > 3) {
                    improvementContent += `- You have ${analysisResult.statistics.longSentences} very long sentences (>30 words)\n`;
                    improvementContent += `- Review these sentences to improve clarity\n`;
                }
                improvementContent += '\n';
            }
            
            // Add call to action
            improvementContent += `Would you like me to help implement any of these suggestions? I can assist with restructuring your document, improving readability, or enhancing specific sections.`;
            
            // Generate dynamic suggestions based on document analysis
            const dynamicSuggestions: string[] = [];
            
            // Add document-type specific suggestions
            if (analysisResult.documentType === 'Academic Paper') {
                dynamicSuggestions.push('Help me improve the abstract');
                dynamicSuggestions.push('Suggest a better methodology section');
            } else if (analysisResult.documentType === 'Business Report') {
                dynamicSuggestions.push('Enhance my executive summary');
                dynamicSuggestions.push('Improve the recommendations section');
            } else {
                dynamicSuggestions.push('Help me with the introduction');
                dynamicSuggestions.push('Create a conclusion section');
            }
            
            // Add general suggestions based on analysis
            if (analysisResult.readabilityLevel === 'Hard') {
                dynamicSuggestions.push('Simplify complex language');
            }
            if (analysisResult.statistics.averageSentenceLength > 25) {
                dynamicSuggestions.push('Break down long sentences');
            }
            if (!analysisResult.structure.hasSections || analysisResult.structure.sectionCount < 3) {
                dynamicSuggestions.push('Add section headings');
            }
            
            // Ensure we have at least 4 suggestions
            while (dynamicSuggestions.length < 4) {
                const generalSuggestions = [
                    'Improve overall document structure',
                    'Check grammar and spelling',
                    'Review for clarity and conciseness',
                    'Help me with formatting',
                    'Enhance document readability'
                ];
                
                // Add a general suggestion that's not already in dynamicSuggestions
                const availableSuggestions = generalSuggestions.filter(s => !dynamicSuggestions.includes(s));
                if (availableSuggestions.length > 0) {
                    dynamicSuggestions.push(availableSuggestions[0]);
                } else {
                    break; // No more suggestions to add
                }
            }
            
            // Create response message
            const improvementsMessage: AssistantMessage = {
                id: crypto.randomUUID(),
                content: improvementContent,
                timestamp: new Date(),
                type: 'assistant',
                suggestions: dynamicSuggestions
            };
            
            // Hide typing indicator and send message
            this._panel.webview.postMessage({
                command: 'hideTypingIndicator'
            });
            
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: improvementsMessage
            });
            
            // Save to conversation history
            this._conversationHistory.addMessage(improvementsMessage);
        } catch (error) {
            console.error('Error suggesting improvements:', error);
            
            if (this._panel) {
                // Hide typing indicator
                this._panel.webview.postMessage({
                    command: 'hideTypingIndicator'
                });
                
                // Send error message
                const errorMessage: AssistantMessage = {
                    id: crypto.randomUUID(),
                    content: `I'm sorry, but I encountered an error while analyzing your document for improvements: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    }
    
    /**
     * Provide help with formatting based on the active document type
     */
    private async _provideFormattingHelp(): Promise<void> {
        if (!this._panel) return;
        
        // Show typing indicator
        this._panel.webview.postMessage({
            command: 'showTypingIndicator'
        });
        
        try {
            // Get the active document information if available
            let documentType = 'Markdown';
            let formatSpecificTips = '';
            let formatSpecificSuggestions: string[] = [];
            
            if (this._activeDocumentUri) {
                const document = await vscode.workspace.openTextDocument(this._activeDocumentUri);
                const documentName = path.basename(this._activeDocumentUri.fsPath);
                const extension = path.extname(documentName).toLowerCase();
                
                // Determine document format based on file extension
                if (extension === '.md') {
                    documentType = 'Markdown';
                    formatSpecificTips = `
                        ## Markdown-Specific Formatting
                        
                        ### Tables
                        \`\`\`markdown
                        | Header 1 | Header 2 | Header 3 |
                        |----------|----------|----------|
                        | Cell 1   | Cell 2   | Cell 3   |
                        | Cell 4   | Cell 5   | Cell 6   |
                        \`\`\`
                        
                        ### Code Blocks
                        \`\`\`markdown
                        \`\`\`javascript
                        function example() {
                            console.log("Hello, world!");
                        }
                        \`\`\`
                        \`\`\`
                        
                        ### Math Equations (using LaTeX syntax)
                        \`\`\`markdown
                        $E = mc^2$
                        
                        $$
                        \\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
                        $$
                        \`\`\`
                    `;
                    
                    formatSpecificSuggestions = [
                        'Help me with Markdown tables',
                        'How to add math equations',
                        'Show me how to create diagrams',
                        'How to add footnotes'
                    ];
                } else if (extension === '.html' || extension === '.htm') {
                    documentType = 'HTML';
                    formatSpecificTips = `
                        ## HTML-Specific Formatting
                        
                        ### Basic Structure
                        \`\`\`html
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Page Title</title>
                            <style>
                                /* CSS styles here */
                            </style>
                        </head>
                        <body>
                            <h1>Main Heading</h1>
                            <p>Paragraph text</p>
                        </body>
                        </html>
                        \`\`\`
                        
                        ### Common Elements
                        \`\`\`html
                        <!-- Headings -->
                        <h1>Heading 1</h1>
                        <h2>Heading 2</h2>
                        
                        <!-- Lists -->
                        <ul>
                            <li>Unordered item</li>
                        </ul>
                        
                        <ol>
                            <li>Ordered item</li>
                        </ol>
                        
                        <!-- Links -->
                        <a href="https://example.com">Link text</a>
                        
                        <!-- Images -->
                        <img src="image.jpg" alt="Description">
                        \`\`\`
                    `;
                    
                    formatSpecificSuggestions = [
                        'Help me with HTML tables',
                        'How to use CSS styling',
                        'Show me form element examples',
                        'How to add responsive design'
                    ];
                } else if (extension === '.docx') {
                    documentType = 'Word Document';
                    formatSpecificTips = `
                        ## Word Document Formatting
                        
                        For DOCX documents, I recommend using MS Word or an equivalent editor for detailed formatting.
                        However, here are some guidelines for when your document is exported:
                        
                        ### Styles
                        - Use consistent heading styles for document structure
                        - Apply paragraph styles for consistent formatting
                        - Use list styles for ordered and unordered lists
                        
                        ### Document Elements
                        - Include a table of contents for longer documents
                        - Use page breaks to control content flow
                        - Add headers and footers for professional documents
                        - Insert cross-references for internal navigation
                    `;
                    
                    formatSpecificSuggestions = [
                        'How to structure a Word document',
                        'Tips for professional formatting',
                        'Help me with section breaks',
                        'How to use styles effectively'
                    ];
                }
            }
            
            // General formatting tips for all document types
            const generalTips = `
                # Formatting Guide for ${documentType} Documents
                
                ## General Formatting Tips
                
                ### Headings
                - Use headings to create a clear document structure
                - Maintain a logical hierarchy (don't skip levels)
                - Keep headings concise and descriptive
                
                ### Text Formatting
                - Use **bold** for emphasis
                - Use *italic* for terms or titles
                - Use consistent formatting throughout the document
                
                ### Lists
                - Use bullet points for unrelated items
                - Use numbered lists for sequential steps
                - Keep list items parallel in structure
                
                ### Spacing
                - Use consistent spacing between sections
                - Add blank lines between paragraphs
                - Keep paragraph length manageable (5-7 lines maximum)
            `;
            
            // Combine general and format-specific tips
            const content = generalTips + (formatSpecificTips ? '\n' + formatSpecificTips : '');
            
            // Default suggestions if no format-specific ones are available
            const defaultSuggestions = [
                'Help me with tables',
                'How do I add images?',
                'Show me code block formatting',
                'How to create a table of contents'
            ];
            
            // Choose which suggestions to use
            const suggestions = formatSpecificSuggestions.length > 0 ? formatSpecificSuggestions : defaultSuggestions;
            
            // Create the formatting message
            const formattingMessage: AssistantMessage = {
                id: crypto.randomUUID(),
                content: content,
                timestamp: new Date(),
                type: 'assistant',
                suggestions: suggestions
            };
            
            // Hide typing indicator
            this._panel.webview.postMessage({
                command: 'hideTypingIndicator'
            });
            
            // Send the message
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: formattingMessage
            });
            
            // Save to conversation history
            this._conversationHistory.addMessage(formattingMessage);
        } catch (error) {
            console.error('Error providing formatting help:', error);
            
            if (this._panel) {
                // Hide typing indicator
                this._panel.webview.postMessage({
                    command: 'hideTypingIndicator'
                });
                
                // Send error message
                const errorMessage: AssistantMessage = {
                    id: crypto.randomUUID(),
                    content: 'I apologize, but I encountered an error while providing formatting help. Let me know if you have specific formatting questions.',
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
                        
                    case 'showPreview':
                        // Show document preview
                        this._showDocumentPreview(message.format);
                        break;
                        
                    case 'exportDocument':
                        // Export document to the specified format
                        this._exportDocument(message.format);
                        break;
                        
                    case 'printDocument':
                        // Print the document
                        this._printDocument();
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
