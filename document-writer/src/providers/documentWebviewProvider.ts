import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { DocumentService } from '../services/documentService';
import { FormatProcessor, DocumentFormat } from '../core/formatProcessor';

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
    private _state: DocumentEditorState = {
        isModified: false,
        viewMode: 'edit'
    };
    
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
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void | Thenable<void> {
        this._view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'media'),
                vscode.Uri.joinPath(this._extensionUri, 'resources')
            ]
        };
        
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        this._setWebviewMessageListener(webviewView.webview);
        
        // Update webview when it becomes visible
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
                
                // Update document content if available
                if (this._state.documentContent) {
                    webviewView.webview.postMessage({
                        command: 'updateContent',
                        content: this._state.documentContent,
                        title: this._state.documentTitle,
                        type: this._state.documentType,
                        viewMode: this._state.viewMode
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
        
        // Use a nonce to whitelist which scripts can be run
        const nonce = getNonce();
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <link href="${styleUri}" rel="stylesheet">
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
                }
            },
            undefined,
            []
        );
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
     * Create a new document
     */
    private _createNewDocument(): void {
        if (!this._view) {
            return;
        }
        
        // Check if there are unsaved changes
        if (this._state.isModified) {
            vscode.window.showWarningMessage(
                'You have unsaved changes. Do you want to save them before creating a new document?',
                'Save',
                'Discard',
                'Cancel'
            ).then(async (selection) => {
                if (selection === 'Save') {
                    await this._saveDocument();
                    this._initNewDocument();
                } else if (selection === 'Discard') {
                    this._initNewDocument();
                }
                // If 'Cancel', do nothing
            });
        } else {
            this._initNewDocument();
        }
    }
    
    /**
     * Initialize a new document
     */
    private _initNewDocument(): void {
        if (!this._view) {
            return;
        }
        
        // Create new document state
        this._state = {
            documentContent: '',
            documentTitle: 'Untitled Document',
            documentType: 'markdown',
            isModified: false,
            viewMode: 'edit'
        };
        
        // Update webview
        this._view.webview.postMessage({
            command: 'updateContent',
            content: '',
            title: this._state.documentTitle,
            type: this._state.documentType,
            viewMode: 'edit'
        });
    }
    
    /**
     * Save the current document
     */
    private async _saveDocument(): Promise<void> {
        if (!this._view || !this._state.documentContent) {
            return;
        }
        
        try {
            // If no document path, prompt for save location
            if (!this._state.documentPath) {
                const fileUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(this._state.documentTitle || 'Untitled Document'),
                    filters: {
                        'Markdown': ['md'],
                        'Text': ['txt'],
                        'All Files': ['*']
                    },
                    title: 'Save Document'
                });
                
                if (!fileUri) {
                    return; // User cancelled
                }
                
                this._state.documentPath = fileUri.fsPath;
                this._state.documentTitle = path.basename(fileUri.fsPath, path.extname(fileUri.fsPath));
                this._state.documentType = path.extname(fileUri.fsPath).slice(1);
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
     * Generate preview content in the specified format
     * @param format The target format for preview
     */
    private async _generatePreview(format: string): Promise<void> {
        if (!this._view || !this._state.documentContent) {
            return;
        }
        
        try {
            // Show loading indicator
            this._view.webview.postMessage({
                command: 'updatePreview',
                content: '<div class="preview-loading">Generating preview...</div>',
                viewMode: this._state.viewMode,
                documentType: this._state.documentType
            });
            
            // Process the content based on document type and target format
            const sourceFormat = this._getDocumentFormatEnum(this._state.documentType || 'markdown');
            const targetFormat = this._getDocumentFormatEnum(format);
            
            // Get the raw converted content
            let previewContent = await this._formatProcessor.processContent(
                this._state.documentContent,
                sourceFormat,
                targetFormat
            );
            
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
        } catch (error) {
            console.error('Error generating preview:', error);
            
            // Send error message to webview
            this._view.webview.postMessage({
                command: 'previewError',
                error: error instanceof Error ? error.message : 'Unknown error generating preview'
            });
        }
    }
    
    /**
     * Format preview content based on document format
     * @param content The raw content
     * @param format The target format
     * @returns Formatted HTML content for the preview
     */
    private _formatPreviewContent(content: string, format: string): string {
        // Format-specific classes and styling
        const formatClass = `preview-format-${format.toLowerCase()}`;
        
        switch (format.toLowerCase()) {
            case 'pdf':
                // For PDF format, display a PDF-like container
                return `<div class="${formatClass}">
                    <div class="preview-content">
                        ${this._enhancePreviewContent(content)}
                    </div>
                </div>`;
                
            case 'docx':
                // For DOCX format, display a Word-like container
                return `<div class="${formatClass}">
                    <div class="preview-content">
                        ${this._enhancePreviewContent(content)}
                    </div>
                </div>`;
                
            case 'html':
                // For HTML, render the content directly with enhancement
                return `<div class="${formatClass}">
                    ${this._enhancePreviewContent(content)}
                </div>`;
                
            case 'markdown':
                // For Markdown in preview mode, render as HTML with proper styling
                const htmlContent = this._formatProcessor.processContent(
                    content,
                    DocumentFormat.MARKDOWN,
                    DocumentFormat.HTML
                );
                return `<div class="${formatClass}">
                    ${this._enhancePreviewContent(htmlContent)}
                </div>`;
                
            default:
                // For other formats like plain text, display in a pre tag
                return `<div class="${formatClass}">
                    <pre class="preview-content-raw">${this._escapeHtml(content)}</pre>
                </div>`;
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
            await this._generatePreview(format);
            
            // Update the format selector
            this._view.webview.postMessage({
                command: 'previewFormatChanged',
                format: format,
                content: this._state.previewContent
            });
        } catch (error) {
            console.error('Error changing preview format:', error);
            vscode.window.showErrorMessage(`Error changing preview format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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
     * Enhance preview content with additional styling and features
     * @param content The HTML content to enhance
     * @returns Enhanced HTML content
     */
    private _enhancePreviewContent(content: string): string {
        // Add syntax highlighting for code blocks
        let enhancedContent = content.replace(
            /<pre><code class="language-([a-zA-Z0-9]+)">([\s\S]*?)<\/code><\/pre>/g,
            '<pre class="code-block language-$1"><code>$2</code></pre>'
        );
        
        // Wrap tables in a container for better responsive behavior
        enhancedContent = enhancedContent.replace(
            /(<table[\s\S]*?<\/table>)/g,
            '<div class="table-container">$1</div>'
        );
        
        // Add image responsive behavior
        enhancedContent = enhancedContent.replace(
            /(<img[^>]*)(>)/g,
            '$1 class="responsive-image"$2'
        );
        
        // Add anchor styling
        enhancedContent = enhancedContent.replace(
            /(<a[^>]*)(>)/g,
            '$1 class="preview-link"$2'
        );
        
        // Process mathematical expressions if present (e.g., LaTeX)
        enhancedContent = this._processMathExpressions(enhancedContent);
        
        return enhancedContent;
    }
    
    /**
     * Process mathematical expressions in content
     * @param content HTML content that may contain math expressions
     * @returns Content with properly formatted math expressions
     */
    private _processMathExpressions(content: string): string {
        // Detect and format inline math expressions $...$
        let processedContent = content.replace(
            /\$([^$\n]+)\$/g,
            '<span class="math-inline">$1</span>'
        );
        
        // Detect and format block math expressions $$...$$
        processedContent = processedContent.replace(
            /\$\$([^$]+)\$\$/g,
            '<div class="math-block">$1</div>'
        );
        
        return processedContent;
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
            this._view.webview.postMessage({
                command: 'updatePreview',
                content: `<div class="preview-loading">Changing preview to ${format.toUpperCase()} format...</div>`,
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
     * Update the document content
     * @param content The new content
     */
    public updateContent(content: string): void {
        if (!this._view) {
            return;
        }
        
        this._state.documentContent = content;
        this._state.isModified = true;
        
        // Update editor content
        this._view.webview.postMessage({
            command: 'updateContent',
            content: content,
            title: this._state.documentTitle,
            type: this._state.documentType,
            viewMode: this._state.viewMode
        });
        
        // If in preview mode, update the preview as well
        if (this._state.viewMode === 'preview' && this._state.previewFormat) {
            // Don't wait for the promise to resolve
            this._refreshPreview(this._state.previewFormat);
        }
    }
    
    /**
     * Get the current document content
     * @returns The document content
     */
    public getContent(): string | undefined {
        return this._state.documentContent;
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
}
