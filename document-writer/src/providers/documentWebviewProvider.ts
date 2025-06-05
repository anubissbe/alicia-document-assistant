import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { DocumentService } from '../services/documentService';
import { FormatProcessor } from '../core/formatProcessor';
import { DocumentFormat } from '../models/documentFormat';
import { PreviewEnhancer } from '../utils/previewEnhancer';

/**
 * Get a nonce to use in HTML to avoid script injection attacks
 * @returns A random string for use in script nonce attribute
 */
function getNonce() {
    return crypto.randomBytes(16).toString('base64');
}

/**
 * Document editor state
 */
interface DocumentEditorState {
    documentPath?: string;
    documentContent?: string;
    documentTitle?: string;
    documentType?: string;
    isModified: boolean;
    viewMode: 'edit' | 'preview';
    previewFormat?: string;
    previewContent?: string;
    lastEdited?: number;
}

/**
 * Webview persistent state
 */
interface WebviewPersistentState {
    documentPath?: string;
    documentTitle?: string;
    documentType?: string;
    content?: string;
    viewMode: 'edit' | 'preview';
    previewFormat?: string;
    previewContent?: string;
    lastEdited?: number;
}

/**
 * DocumentWebviewProvider manages the document editor webview
 */
export class DocumentWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'documentWriter.documentEditor';
    
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _documentService: DocumentService;
    private _formatProcessor: FormatProcessor;
    private _previewEnhancer: PreviewEnhancer;
    private _state: DocumentEditorState = {
        isModified: false,
        viewMode: 'edit'
    };
    
    // Static storage for persisting state across extension restarts
    private static readonly _stateStorage = new Map<string, WebviewPersistentState>();
    private _storageKey: string = 'default';
    
    /**
     * Constructor
     * @param extensionUri The extension URI
     * @param documentService The document service
     * @param formatProcessor The format processor
     */
    constructor(
        extensionUri: vscode.Uri,
        documentService: DocumentService,
        formatProcessor: FormatProcessor
    ) {
        this._extensionUri = extensionUri;
        this._documentService = documentService;
        this._formatProcessor = formatProcessor;
        this._previewEnhancer = PreviewEnhancer.getInstance();
        
        // Generate a unique storage key for this instance
        this._storageKey = `documentEditor_${Date.now()}`;
        
        // Register commands
        this._registerCommands();
    }
    
    /**
     * Register commands
     */
    private _registerCommands(): void {
        vscode.commands.registerCommand('documentWriter.openDocumentEditor', (documentPath?: string) => {
            vscode.commands.executeCommand('documentWriter.documentEditor.focus');
            if (documentPath) {
                this._loadDocument(documentPath);
            }
        });
        
        vscode.commands.registerCommand('documentWriter.newDocument', () => {
            vscode.commands.executeCommand('documentWriter.documentEditor.focus');
            this._createNewDocument();
        });
        
        vscode.commands.registerCommand('documentWriter.saveDocument', () => {
            this._saveDocument();
        });
        
        vscode.commands.registerCommand('documentWriter.togglePreview', () => {
            this._togglePreviewMode();
        });
        
        vscode.commands.registerCommand('documentWriter.exportDocument', (format: string) => {
            this._exportDocument(format);
        });
    }
    
    /**
     * Resolve the webview view
     * @param webviewView The webview view
     * @param context The webview view resolve context
     * @param token A cancellation token
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void | Thenable<void> {
        this._view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'media'),
                vscode.Uri.joinPath(this._extensionUri, 'resources')
            ]
        };
        
        // Try to restore persistent state
        this._tryRestorePersistentState();
        
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        this._setWebviewMessageListener(webviewView.webview);
        
        // Update webview when it becomes visible
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
                
                // Request state restoration from webview
                setTimeout(() => {
                    if (webviewView.webview) {
                        webviewView.webview.postMessage({
                            command: 'restoreState'
                        });
                    }
                }, 200);
                
                // As fallback, also send our version of state
                if (this._state.documentContent) {
                    webviewView.webview.postMessage({
                        command: 'updateContent',
                        content: this._state.documentContent,
                        title: this._state.documentTitle,
                        type: this._state.documentType,
                        viewMode: this._state.viewMode,
                        path: this._state.documentPath
                    });
                }
            }
        });
    }
    
    /**
     * Get the HTML for the webview
     * @param webview The webview
     * @returns The HTML string
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Create URIs for scripts and styles
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'documentEditor.js')
        );
        
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'documentEditor.css')
        );
        
        // Get responsive styles and preview enhancer script
        const responsiveStyleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'responsive.css')
        );
        
        const previewEnhancerUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'previewEnhancer.js')
        );
        
        // Use a nonce to whitelist which scripts can be run
        const nonce = getNonce();
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <link href="${styleUri}" rel="stylesheet">
            <link href="${responsiveStyleUri}" rel="stylesheet">
            <title>Document Editor</title>
        </head>
        <body>
            <div class="editor-container">
                <div class="editor-header">
                    <div class="document-title" id="document-title">${this._state.documentTitle || 'Untitled Document'}</div>
                    <div class="editor-actions">
                        <button id="btn-save" class="action-button" title="Save Document">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                        </button>
                        <button id="btn-toggle-preview" class="action-button" title="Toggle Preview">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                        <div class="dropdown">
                            <button id="btn-export" class="action-button" title="Export Document">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </button>
                            <div class="dropdown-content" id="export-options">
                                <a href="#" data-format="pdf">PDF</a>
                                <a href="#" data-format="docx">Word (DOCX)</a>
                                <a href="#" data-format="html">HTML</a>
                                <a href="#" data-format="markdown">Markdown</a>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="editor-area" class="${this._state.viewMode === 'edit' ? '' : 'hidden'}">
                    <textarea id="document-content">${this._state.documentContent || ''}</textarea>
                </div>
                
                <div id="preview-area" class="${this._state.viewMode === 'preview' ? '' : 'hidden'}">
                    <div class="preview-header">
                        <div class="preview-format-selector">
                            <label for="preview-format">Preview Format:</label>
                            <select id="preview-format">
                                <option value="html" selected>HTML</option>
                                <option value="pdf">PDF</option>
                                <option value="docx">Word</option>
                                <option value="markdown">Markdown</option>
                            </select>
                        </div>
                        <div class="preview-actions">
                            <button id="btn-refresh-preview" class="action-button" title="Refresh Preview">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M23 4v6h-6"></path>
                                    <path d="M1 20v-6h6"></path>
                                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10"></path>
                                    <path d="M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div id="preview-content"></div>
                </div>
            </div>
            
            <script nonce="${nonce}" src="${scriptUri}"></script>
            <script nonce="${nonce}" src="${previewEnhancerUri}"></script>
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
                    case 'contentChanged':
                        // Update the content in state
                        this._state.documentContent = message.content;
                        this._state.isModified = true;
                        this._state.lastEdited = Date.now();
                        break;
                        
                    case 'saveDocument':
                        await this._saveDocument();
                        break;
                        
                    case 'togglePreview':
                        this._togglePreviewMode();
                        break;
                        
                    case 'exportDocument':
                        await this._exportDocument(message.format);
                        break;
                        
                    case 'updateTitle':
                        this._state.documentTitle = message.title;
                        this._state.isModified = true;
                        break;
                        
                    case 'changePreviewFormat':
                        await this._changePreviewFormat(message.format);
                        break;
                        
                    case 'refreshPreview':
                        await this._refreshPreview(message.format);
                        break;
                        
                    case 'persistState':
                        // Handle state persistence from webview
                        if (message.state) {
                            this._persistWebviewState(message.state);
                        }
                        break;
                        
                    case 'stateRestored':
                        // Webview has restored its state, synchronize with our state
                        if (message.state) {
                            this._synchronizeStateFromWebview(message.state);
                        }
                        break;
                }
            },
            undefined,
            []
        );
    }
    
    /**
     * Persist webview state for restoration across sessions
     * @param state The state to persist
     */
    private _persistWebviewState(state: WebviewPersistentState): void {
        // Update our local state
        if (state.content) {
            this._state.documentContent = state.content;
        }
        
        if (state.documentTitle) {
            this._state.documentTitle = state.documentTitle;
        }
        
        if (state.documentPath) {
            this._state.documentPath = state.documentPath;
        }
        
        if (state.documentType) {
            this._state.documentType = state.documentType;
        }
        
        this._state.viewMode = state.viewMode;
        this._state.previewFormat = state.previewFormat;
        this._state.previewContent = state.previewContent;
        this._state.lastEdited = state.lastEdited;
        
        // Store in the static map for persistence across extension restarts
        DocumentWebviewProvider._stateStorage.set(this._storageKey, {
            documentPath: state.documentPath,
            documentTitle: state.documentTitle,
            documentType: state.documentType,
            content: state.content,
            viewMode: state.viewMode,
            previewFormat: state.previewFormat,
            previewContent: state.previewContent,
            lastEdited: state.lastEdited
        });
        
        // Consider also using VSCode's ExtensionContext.globalState or workspaceState
        // for persistent storage across VS Code restarts
    }
    
    /**
     * Synchronize state from webview
     * @param state The state from webview
     */
    private _synchronizeStateFromWebview(state: WebviewPersistentState): void {
        // Compare timestamps to decide which state is more recent
        const currentTimestamp = this._state.lastEdited || 0;
        const webviewTimestamp = state.lastEdited || 0;
        
        if (webviewTimestamp > currentTimestamp) {
            // Webview state is more recent, update our state
            this._persistWebviewState(state);
        } else if (webviewTimestamp < currentTimestamp && this._view) {
            // Our state is more recent, update webview
            this._view.webview.postMessage({
                command: 'updateContent',
                content: this._state.documentContent,
                title: this._state.documentTitle,
                type: this._state.documentType,
                viewMode: this._state.viewMode,
                path: this._state.documentPath
            });
            
            // If in preview mode, also update preview content
            if (this._state.viewMode === 'preview' && this._state.previewContent) {
                this._view.webview.postMessage({
                    command: 'updatePreview',
                    content: this._state.previewContent,
                    format: this._state.previewFormat,
                    viewMode: this._state.viewMode
                });
            }
        }
    }
    
    /**
     * Try to restore persistent state
     */
    private _tryRestorePersistentState(): void {
        // Try to get saved state from static storage
        const savedState = DocumentWebviewProvider._stateStorage.get(this._storageKey);
        
        if (savedState) {
            // Update our state with saved values
            if (savedState.content) {
                this._state.documentContent = savedState.content;
            }
            
            if (savedState.documentTitle) {
                this._state.documentTitle = savedState.documentTitle;
            }
            
            if (savedState.documentPath) {
                this._state.documentPath = savedState.documentPath;
            }
            
            if (savedState.documentType) {
                this._state.documentType = savedState.documentType;
            }
            
            this._state.viewMode = savedState.viewMode;
            this._state.previewFormat = savedState.previewFormat;
            this._state.previewContent = savedState.previewContent;
            this._state.lastEdited = savedState.lastEdited;
            
            // Document is not modified after restoration
            this._state.isModified = false;
        }
    }
    
    /**
     * Load a document
     * @param documentPath The document path
     */
    private async _loadDocument(documentPath: string): Promise<void> {
        if (!this._view) {
            return;
        }
        
        try {
            // Get document content
            const document = await this._documentService.getDocument(documentPath);
            
            // Update state
            this._state = {
                documentPath,
                documentContent: document.content,
                documentTitle: document.title || path.basename(documentPath, path.extname(documentPath)),
                documentType: document.type || path.extname(documentPath).slice(1),
                isModified: false,
                viewMode: 'edit'
            };
            
            // Update webview
            this._view.webview.postMessage({
                command: 'updateContent',
                content: this._state.documentContent,
                title: this._state.documentTitle,
                type: this._state.documentType,
                viewMode: this._state.viewMode
            });
            
            vscode.window.showInformationMessage(`Opened ${this._state.documentTitle}`);
        } catch (error) {
            console.error('Error loading document:', error);
            vscode.window.showErrorMessage(`Error loading document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Generate preview content in the specified format
     * @param format The format to preview
     */
    private async _generatePreview(format: string): Promise<void> {
        if (!this._view || !this._state.documentContent) {
            return;
        }
        
        try {
            // Show loading indicator with animation
            const loadingHtml = this._view.webview ? this._previewEnhancer.getPreviewLoadingHtml(
                this._view.webview,
                `Generating ${format.toUpperCase()} preview...`
            ) : `<div>Loading...</div>`;
            
            this._view.webview.postMessage({
                command: 'updatePreview',
                content: loadingHtml,
                viewMode: this._state.viewMode,
                documentType: this._state.documentType
            });
            
            // Process the content based on document type and target format
            const sourceFormat = this._getDocumentFormatEnum(this._state.documentType || 'markdown');
            const targetFormat = this._getDocumentFormatEnum(format);
            
            // Add timeout handling for preview generation
            const timeoutPromise = new Promise<string>((_, reject) => {
                setTimeout(() => reject(new Error('Preview generation timed out')), 10000);
            });
            
            const conversionPromise = this._formatProcessor.processContent(
                this._state.documentContent,
                sourceFormat,
                targetFormat
            );
            
            // Race between conversion and timeout
            let previewContent = await Promise.race([conversionPromise, timeoutPromise]) as string;
            
            // Apply additional processing based on format
            if (format.toLowerCase() === 'pdf') {
                previewContent = this._enhancePdfPreview(previewContent);
            } else if (format.toLowerCase() === 'docx') {
                previewContent = this._enhanceDocxPreview(previewContent);
            }
            
            // Apply format-specific wrapping and styling
            const formattedContent = this._formatPreviewContent(previewContent, format);
            
            // Update webview with the formatted content
            this._view.webview.postMessage({
                command: 'updatePreview',
                content: formattedContent,
                viewMode: this._state.viewMode,
                documentType: this._state.documentType,
                format: format
            });
            
            // Save preview state
            this._state.previewFormat = format;
            this._state.previewContent = formattedContent;
            
            // Persist state with preview content
            this._persistWebviewState({
                documentPath: this._state.documentPath,
                documentTitle: this._state.documentTitle,
                documentType: this._state.documentType,
                content: this._state.documentContent,
                viewMode: this._state.viewMode,
                previewFormat: format,
                previewContent: formattedContent,
                lastEdited: Date.now()
            });
            
        } catch (error) {
            console.error('Error generating preview:', error);
            
            // Create error message with the PreviewEnhancer
            const errorHtml = this._view.webview ? this._previewEnhancer.getPreviewErrorHtml(
                this._view.webview,
                `Preview Error`,
                `Error generating ${format} preview: ${error instanceof Error ? error.message : 'Unknown error'}. 
                Try a different format or check your document structure.`
            ) : `<div>Error generating preview</div>`;
            
            // Send error message to webview
            this._view.webview.postMessage({
                command: 'previewError',
                error: errorHtml
            });
        }
    }
    
    /**
     * Save the current document
     */
    private async _saveDocument(): Promise<void> {
        if (!this._view || !this._state.documentContent) {
            return;
        }
        
        try {
            // If documentPath is not set, prompt for save location
            if (!this._state.documentPath) {
                const fileUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(`${this._state.documentTitle || 'Untitled Document'}.md`),
                    filters: {
                        'Markdown': ['md'],
                        'HTML': ['html'],
                        'Text': ['txt']
                    },
                    title: 'Save Document'
                });
                
                if (!fileUri) {
                    return; // User cancelled
                }
                
                this._state.documentPath = fileUri.fsPath;
                this._state.documentType = path.extname(fileUri.fsPath).slice(1) || 'md';
            }
            
            // Save the document
            await this._documentService.saveDocument({
                path: this._state.documentPath,
                content: this._state.documentContent,
                title: this._state.documentTitle,
                type: this._state.documentType
            });
            
            // Update state
            this._state.isModified = false;
            
            // Update webview
            this._view.webview.postMessage({
                command: 'documentSaved',
                path: this._state.documentPath,
                title: this._state.documentTitle
            });
            
            // Update last edited timestamp
            this._state.lastEdited = Date.now();
            
            // Update persistent state
            this._persistWebviewState({
                documentPath: this._state.documentPath,
                documentTitle: this._state.documentTitle,
                documentType: this._state.documentType,
                content: this._state.documentContent,
                viewMode: this._state.viewMode,
                previewFormat: this._state.previewFormat,
                previewContent: this._state.previewContent,
                lastEdited: this._state.lastEdited
            });
            
            vscode.window.showInformationMessage(`Saved ${this._state.documentTitle}`);
        } catch (error) {
            console.error('Error saving document:', error);
            vscode.window.showErrorMessage(`Error saving document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Toggle between edit and preview modes
     */
    private _togglePreviewMode(): void {
        if (!this._view || !this._state.documentContent) {
            return;
        }
        
        // Toggle view mode
        this._state.viewMode = this._state.viewMode === 'edit' ? 'preview' : 'edit';
        
        // If switching to preview mode, generate preview content
        if (this._state.viewMode === 'preview') {
            try {
                // Use the current preview format or default to HTML
                const previewFormat = this._state.previewFormat || 'html';
                
                // Generate preview in the selected format
                this._generatePreview(previewFormat);
            } catch (error) {
                console.error('Error generating preview:', error);
                vscode.window.showErrorMessage(`Error generating preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
                
                // Revert to edit mode
                this._state.viewMode = 'edit';
                this._view.webview.postMessage({
                    command: 'updateViewMode',
                    viewMode: this._state.viewMode
                });
            }
        } else {
            // Just update the view mode
            this._view.webview.postMessage({
                command: 'updateViewMode',
                viewMode: this._state.viewMode
            });
        }
    }
    
    /**
     * Create a new empty document
     */
    private _createNewDocument(): void {
        if (!this._view) {
            return;
        }
        
        // Check if there are unsaved changes
        if (this._state.isModified) {
            vscode.window.showWarningMessage(
                'You have unsaved changes. Do you want to save them before creating a new document?',
                'Save', 'Discard', 'Cancel'
            ).then(async (selection) => {
                if (selection === 'Save') {
                    await this._saveDocument();
                    this._resetDocument();
                } else if (selection === 'Discard') {
                    this._resetDocument();
                }
                // If 'Cancel', do nothing
            });
        } else {
            this._resetDocument();
        }
    }
    
    /**
     * Reset the document to an empty state
     */
    private _resetDocument(): void {
        if (!this._view) {
            return;
        }
        
        // Reset state to a new document
        this._state = {
            documentContent: '',
            documentTitle: 'Untitled Document',
            documentType: 'markdown', // Default to markdown
            isModified: false,
            viewMode: 'edit'
        };
        
        // Update webview
        this._view.webview.postMessage({
            command: 'updateContent',
            content: '',
            title: this._state.documentTitle,
            type: this._state.documentType,
            viewMode: this._state.viewMode
        });
        
        // Update persistent state
        this._persistWebviewState({
            documentTitle: this._state.documentTitle,
            documentType: this._state.documentType,
            content: this._state.documentContent,
            viewMode: this._state.viewMode,
            lastEdited: Date.now()
        });
    }
    
    /**
     * Format preview content with appropriate styling
     * @param content Raw HTML content
     * @param format The target format
     * @returns Formatted HTML content
     */
    private _formatPreviewContent(content: string, format: string): string {
        // Create a temporary panel for preview
        let formattedContent = content;
        
        // For responsive container, we need the webview
        if (this._view) {
            // Get format-specific title and class
            const formatTitle = `${format.charAt(0).toUpperCase() + format.slice(1)} Preview`;
            const formatClass = `${format.toLowerCase()}-preview`;
            
            // Wrap in responsive container
            formattedContent = this._previewEnhancer.getResponsivePreviewContainer(
                content,
                { 
                    className: formatClass,
                    title: formatTitle,
                    showHeader: true
                }
            );
        }
        
        return formattedContent;
    }
    
    /**
     * Enhance PDF preview with specific styling
     * @param content HTML content for the PDF preview
     * @returns Enhanced HTML content
     */
    private _enhancePdfPreview(content: string): string {
        // Add PDF-specific page styling
        return `<div class="pdf-preview">
            <div class="pdf-page">
                <div class="pdf-content">
                    ${content}
                </div>
                <div class="pdf-page-number">1</div>
            </div>
        </div>`;
    }
    
    /**
     * Enhance DOCX preview with Word-like styling
     * @param content HTML content for the DOCX preview
     * @returns Enhanced HTML content
     */
    private _enhanceDocxPreview(content: string): string {
        // Add Word-like styling
        return `<div class="docx-preview">
            <div class="docx-page">
                <div class="docx-content">
                    ${content}
                </div>
            </div>
        </div>`;
    }
    
    
    /**
     * Refresh the preview with the current content
     * @param format The format to preview
     */
    private async _refreshPreview(format: string): Promise<void> {
        if (!this._view || !this._state.documentContent || this._state.viewMode !== 'preview') {
            return;
        }
        
        try {
            await this._generatePreview(format);
            vscode.window.showInformationMessage(`Preview refreshed`);
        } catch (error) {
            console.error('Error refreshing preview:', error);
            vscode.window.showErrorMessage(`Error refreshing preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Export the document to a different format
     * @param format The target format
     */
    private async _exportDocument(format: string): Promise<void> {
        if (!this._view || !this._state.documentContent) {
            return;
        }
        
        try {
            // Get file extension for the target format
            const fileExtension = this._getFileExtensionForFormat(format);
            
            // Prompt for export location
            const baseFileName = this._state.documentTitle || 'Untitled Document';
            const fileUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${baseFileName}.${fileExtension}`),
                filters: {
                    [format.toUpperCase()]: [fileExtension]
                },
                title: `Export Document as ${format.toUpperCase()}`
            });
            
            if (!fileUri) {
                return; // User cancelled
            }
            
            // Process the content
            const sourceFormat = this._getDocumentFormatEnum(this._state.documentType || 'markdown');
            const targetFormat = this._getDocumentFormatEnum(format);
            const exportContent = this._formatProcessor.processContent(
                this._state.documentContent,
                sourceFormat,
                targetFormat
            );
            
            // Save the exported document
            await this._documentService.saveDocument({
                path: fileUri.fsPath,
                content: exportContent,
                title: this._state.documentTitle,
                type: format
            });
            
            vscode.window.showInformationMessage(`Exported ${this._state.documentTitle} as ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Error exporting document:', error);
            vscode.window.showErrorMessage(`Error exporting document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Get file extension for a format
     * @param format The format
     * @returns The file extension
     */
    private _getFileExtensionForFormat(format: string): string {
        switch (format.toLowerCase()) {
            case 'pdf':
                return 'pdf';
            case 'docx':
                return 'docx';
            case 'html':
                return 'html';
            case 'markdown':
                return 'md';
            case 'text':
                return 'txt';
            default:
                return format.toLowerCase();
        }
    }
    
    /**
     * Change the preview format
     * @param format The new format to preview
     */
    private async _changePreviewFormat(format: string): Promise<void> {
        if (!this._view || !this._state.documentContent || this._state.viewMode !== 'preview') {
            return;
        }
        
        try {
            // Show a notification that format is changing
            const loadingHtml = this._view.webview ? this._previewEnhancer.getPreviewLoadingHtml(
                this._view.webview,
                `Changing preview to ${format.toUpperCase()} format...`
            ) : `<div>Loading...</div>`;
            
            this._view.webview.postMessage({
                command: 'updatePreview',
                content: loadingHtml,
                viewMode: this._state.viewMode,
                documentType: this._state.documentType
            });
            
            // Generate the preview in the new format
            await this._generatePreview(format);
            
            // Update the format selector
            this._view.webview.postMessage({
                command: 'previewFormatChanged',
                format: format,
                content: this._state.previewContent
            });
            
            // Display a notification about the format change
            vscode.window.setStatusBarMessage(`Preview changed to ${format.toUpperCase()} format`, 3000);
        } catch (error) {
            console.error('Error changing preview format:', error);
            vscode.window.showErrorMessage(`Error changing preview format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Get the current document title
     * @returns The document title
     */
    public getTitle(): string | undefined {
        return this._state.documentTitle;
    }
    
    /**
     * Get the current document path
     * @returns The document path
     */
    public getPath(): string | undefined {
        return this._state.documentPath;
    }
    
    /**
     * Check if the document has unsaved changes
     * @returns True if the document has unsaved changes
     */
    public hasUnsavedChanges(): boolean {
        return this._state.isModified;
    }
    
    /**
     * Escape HTML special characters to prevent XSS
     * @param html The raw HTML to escape
     * @returns The escaped HTML string
     */
    private _escapeHtml(html: string): string {
        return html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    /**
     * Get DocumentFormat enum from string format
     * @param format The format string
     * @returns The corresponding DocumentFormat enum
     */
    private _getDocumentFormatEnum(format: string): DocumentFormat {
        format = format.toLowerCase();
        switch (format) {
            case 'pdf':
                return DocumentFormat.PDF;
            case 'docx':
                return DocumentFormat.DOCX;
            case 'html':
                return DocumentFormat.HTML;
            case 'markdown':
            case 'md':
                return DocumentFormat.MARKDOWN;
            case 'text':
            case 'txt':
                return DocumentFormat.TEXT;
            default:
                return DocumentFormat.MARKDOWN; // Default to markdown
        }
    }
    
    /**
     * Open a document in the editor
     * @param document The document to open
     */
    public openEditor(document?: any): void {
        if (document) {
            // Load the document into the editor
            this._state.documentContent = document.content || '';
            this._state.documentTitle = document.title || 'Untitled';
            this._state.documentType = document.type || 'markdown';
            this._state.documentPath = document.path;
            this._state.isModified = false;
            this._state.viewMode = 'edit';
            
            // Update the webview if it exists
            if (this._view) {
                this._view.webview.postMessage({
                    command: 'updateContent',
                    content: this._state.documentContent,
                    title: this._state.documentTitle,
                    type: this._state.documentType,
                    viewMode: this._state.viewMode,
                    path: this._state.documentPath
                });
            }
        }
        
        // Show the webview if not already visible
        if (this._view) {
            this._view.show(true);
        }
    }
    
    /**
     * Create a new document in the editor
     */
    public createNewDocument(): void {
        // Reset state for new document
        this._state.documentContent = '';
        this._state.documentTitle = 'Untitled';
        this._state.documentType = 'markdown';
        this._state.documentPath = undefined;
        this._state.isModified = false;
        this._state.viewMode = 'edit';
        
        // Update the webview if it exists
        if (this._view) {
            this._view.webview.postMessage({
                command: 'updateContent',
                content: this._state.documentContent,
                title: this._state.documentTitle,
                type: this._state.documentType,
                viewMode: this._state.viewMode,
                path: this._state.documentPath
            });
            
            this._view.show(true);
        }
    }
}
