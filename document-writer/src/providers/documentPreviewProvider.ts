import * as vscode from 'vscode';
import * as path from 'path';
import { DocumentFormatConverter, DocumentPreviewOptions, PreviewOptions } from '../utils/documentFormatConverter';
import { DocumentFormat } from '../models/documentFormat';
import { SecurityManager } from '../utils/securityManager';
import { PathSafetyUtils } from '../utils/pathSafetyUtils';
import { PDFPreviewProvider } from '../utils/pdfPreviewProvider';
import { ExportUtils } from '../utils/exportUtils';

/**
 * Provider for document previews in different formats
 * Manages the rendering and display of document content in various formats
 */
export class DocumentPreviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'document-writer.preview';
    
    private _view?: vscode.WebviewView;
    private _formatConverter: DocumentFormatConverter;
    private _securityManager: SecurityManager;
    private _pathSafetyUtils: PathSafetyUtils;
    private _pdfPreviewProvider: PDFPreviewProvider;
    private _currentDocument?: vscode.TextDocument;
    private _currentFormat: DocumentFormat = DocumentFormat.MARKDOWN;
    private _targetFormat: DocumentFormat = DocumentFormat.HTML;
    private _previewOptions: PreviewOptions = {
        interactive: true,
        renderMath: true,
        renderDiagrams: true,
        highlightSyntax: true,
        showAnnotations: true
    };
    
    private _disposables: vscode.Disposable[] = [];
    
    /**
     * Constructor
     * @param extensionUri The extension URI
     */
    constructor(private readonly extensionUri: vscode.Uri) {
        this._formatConverter = new DocumentFormatConverter();
        this._securityManager = new SecurityManager();
        this._pathSafetyUtils = new PathSafetyUtils(this._securityManager);
        this._pdfPreviewProvider = new PDFPreviewProvider();
        
        // Register disposables
        this._disposables.push(
            vscode.window.onDidChangeActiveTextEditor(this._onDidChangeActiveTextEditor, this),
            vscode.workspace.onDidChangeTextDocument(this._onDidChangeTextDocument, this)
        );
    }
    
    /**
     * Resolve the webview view
     * @param webviewView The webview view
     * @param context The webview view context
     * @param token The cancellation token
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void | Thenable<void> {
        this._view = webviewView;
        
        // Configure webview
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.extensionUri
            ]
        };
        
        // Set initial content
        webviewView.webview.html = this._getInitialHtml();
        
        // Set up message handling
        webviewView.webview.onDidReceiveMessage(this._handleMessage, this);
        
        // Update preview with current document
        this._updatePreview();
    }
    
    /**
     * Dispose of resources
     */
    public dispose(): void {
        // Clean up resources
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
    
    /**
     * Handle changes to the active text editor
     * @param editor The active text editor
     */
    private _onDidChangeActiveTextEditor(editor?: vscode.TextEditor): void {
        if (!editor) {
            return;
        }
        
        // Update current document
        this._currentDocument = editor.document;
        
        // Detect format from file extension
        const filePath = editor.document.fileName;
        const extension = path.extname(filePath).toLowerCase();
        
        if (extension === '.md' || extension === '.markdown') {
            this._currentFormat = DocumentFormat.MARKDOWN;
        } else if (extension === '.html' || extension === '.htm') {
            this._currentFormat = DocumentFormat.HTML;
        } else if (extension === '.txt') {
            this._currentFormat = DocumentFormat.TEXT;
        } else if (extension === '.docx' || extension === '.doc') {
            this._currentFormat = DocumentFormat.DOCX;
        } else if (extension === '.pdf') {
            this._currentFormat = DocumentFormat.PDF;
        } else {
            // Try to detect from content
            const content = editor.document.getText();
            const detectionResult = this._formatConverter.detectFormat(content, filePath);
            this._currentFormat = detectionResult.format;
        }
        
        // Update preview
        this._updatePreview();
    }
    
    /**
     * Handle changes to the text document
     * @param event The text document change event
     */
    private _onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): void {
        // Check if the changed document is the current document
        if (this._currentDocument && event.document.uri.toString() === this._currentDocument.uri.toString()) {
            // Update preview (with debouncing)
            this._debouncedUpdatePreview();
        }
    }
    
    // Debounce value to prevent too many updates
    private _debounceTimeout: NodeJS.Timeout | undefined;
    
    /**
     * Debounced update preview
     */
    private _debouncedUpdatePreview(): void {
        // Clear existing timeout
        if (this._debounceTimeout) {
            clearTimeout(this._debounceTimeout);
        }
        
        // Set new timeout
        this._debounceTimeout = setTimeout(() => {
            this._updatePreview();
        }, 300); // 300ms debounce time
    }
    
    /**
     * Update the preview
     */
    private async _updatePreview(): Promise<void> {
        // Check if view is available
        if (!this._view) {
            return;
        }
        
        // Check if document is available
        if (!this._currentDocument) {
            // Show placeholder content
            this._view.webview.html = this._getPlaceholderHtml();
            return;
        }
        
        try {
            // Get document content
            const content = this._currentDocument.getText();
            
            // Generate preview
            const previewOptions: DocumentPreviewOptions = {
                targetFormat: this._targetFormat,
                preview: this._previewOptions,
                preserveFormatting: true,
                includeStyles: true
            };
            
            // Special handling for PDF source format
            if (this._currentFormat === DocumentFormat.PDF) {
                await this._handlePdfPreview(content);
            } else {
                const previewContent = await this._formatConverter.generatePreview(
                    content,
                    this._currentFormat,
                    previewOptions
                );
                
                // Update webview with preview content
                if (this._targetFormat === DocumentFormat.HTML) {
                    // For HTML, we need to inject our custom script
                    const enhancedHtml = this._enhanceHtmlForWebview(previewContent);
                    this._view.webview.html = enhancedHtml;
                } else {
                    // For other formats, display as plain text or convert to HTML
                    this._view.webview.html = this._wrapInHtml(previewContent);
                }
            }
        } catch (error) {
            // Show error in preview
            this._view.webview.html = this._getErrorHtml(error);
        }
    }
    
    /**
     * Enhance HTML for webview
     * @param html The HTML content
     * @returns Enhanced HTML for webview
     */
    private _enhanceHtmlForWebview(html: string): string {
        // Get webview URI for the script
        const scriptUri = this._view!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'previewEnhancer.js')
        );
        
        // Get webview URI for the CSS
        const styleUri = this._view!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'previewEnhancer.css')
        );
        
        // Get webview URI for responsive CSS
        const responsiveUri = this._view!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'responsive.css')
        );
        
        // Check if HTML already has head and body tags
        if (html.includes('<head>')) {
            // Insert script and style into existing head
            return html.replace('</head>', `
                <link rel="stylesheet" href="${styleUri}">
                <link rel="stylesheet" href="${responsiveUri}">
                <script src="${scriptUri}"></script>
                </head>
            `);
        } else if (html.includes('<body>')) {
            // Add head with script and style
            return html.replace('<body>', `
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <link rel="stylesheet" href="${styleUri}">
                    <link rel="stylesheet" href="${responsiveUri}">
                    <script src="${scriptUri}"></script>
                </head>
                <body>
            `);
        } else {
            // Create full HTML document
            return `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <link rel="stylesheet" href="${styleUri}">
                    <link rel="stylesheet" href="${responsiveUri}">
                    <script src="${scriptUri}"></script>
                </head>
                <body>
                    ${html}
                </body>
                </html>
            `;
        }
    }
    
    /**
     * Wrap content in HTML
     * @param content The content to wrap
     * @returns HTML wrapped content
     */
    private _wrapInHtml(content: string): string {
        // Get webview URI for the CSS
        const styleUri = this._view!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'previewEnhancer.css')
        );
        
        // Get webview URI for responsive CSS
        const responsiveUri = this._view!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'responsive.css')
        );
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="${styleUri}">
                <link rel="stylesheet" href="${responsiveUri}">
                <style>
                    .preview-content {
                        white-space: pre-wrap;
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                    }
                </style>
            </head>
            <body>
                <div class="preview-content">${this._escapeHtml(content)}</div>
            </body>
            </html>
        `;
    }
    
    /**
     * Get initial HTML for the webview
     * @returns Initial HTML content
     */
    private _getInitialHtml(): string {
        // Get webview URI for the CSS
        const styleUri = this._view!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'previewEnhancer.css')
        );
        
        // Get webview URI for responsive CSS
        const responsiveUri = this._view!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'responsive.css')
        );
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="${styleUri}">
                <link rel="stylesheet" href="${responsiveUri}">
                <style>
                    .preview-placeholder {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        text-align: center;
                        padding: 20px;
                    }
                    
                    .preview-placeholder h2 {
                        margin-bottom: 10px;
                    }
                    
                    .preview-placeholder p {
                        margin-bottom: 20px;
                    }
                    
                    .format-selector {
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="preview-placeholder">
                    <h2>Document Preview</h2>
                    <p>Open a document to see a preview</p>
                    <div class="format-selector">
                        <label for="format-select">Preview Format:</label>
                        <select id="format-select">
                            <option value="html">HTML</option>
                            <option value="markdown">Markdown</option>
                            <option value="text">Plain Text</option>
                        </select>
                    </div>
                    <div class="preview-options">
                        <h3>Preview Options</h3>
                        <div>
                            <input type="checkbox" id="interactive" checked>
                            <label for="interactive">Interactive</label>
                        </div>
                        <div>
                            <input type="checkbox" id="render-math" checked>
                            <label for="render-math">Render Math</label>
                        </div>
                        <div>
                            <input type="checkbox" id="render-diagrams" checked>
                            <label for="render-diagrams">Render Diagrams</label>
                        </div>
                        <div>
                            <input type="checkbox" id="highlight-syntax" checked>
                            <label for="highlight-syntax">Highlight Syntax</label>
                        </div>
                        <div>
                            <input type="checkbox" id="show-annotations" checked>
                            <label for="show-annotations">Show Annotations</label>
                        </div>
                    </div>
                </div>
                <script>
                    (function() {
                        // Get elements
                        const formatSelect = document.getElementById('format-select');
                        const interactiveCheckbox = document.getElementById('interactive');
                        const renderMathCheckbox = document.getElementById('render-math');
                        const renderDiagramsCheckbox = document.getElementById('render-diagrams');
                        const highlightSyntaxCheckbox = document.getElementById('highlight-syntax');
                        const showAnnotationsCheckbox = document.getElementById('show-annotations');
                        
                        // Set up event listeners
                        formatSelect.addEventListener('change', () => {
                            const vscode = acquireVsCodeApi();
                            vscode.postMessage({
                                command: 'setTargetFormat',
                                format: formatSelect.value
                            });
                        });
                        
                        interactiveCheckbox.addEventListener('change', () => {
                            const vscode = acquireVsCodeApi();
                            vscode.postMessage({
                                command: 'setPreviewOption',
                                option: 'interactive',
                                value: interactiveCheckbox.checked
                            });
                        });
                        
                        renderMathCheckbox.addEventListener('change', () => {
                            const vscode = acquireVsCodeApi();
                            vscode.postMessage({
                                command: 'setPreviewOption',
                                option: 'renderMath',
                                value: renderMathCheckbox.checked
                            });
                        });
                        
                        renderDiagramsCheckbox.addEventListener('change', () => {
                            const vscode = acquireVsCodeApi();
                            vscode.postMessage({
                                command: 'setPreviewOption',
                                option: 'renderDiagrams',
                                value: renderDiagramsCheckbox.checked
                            });
                        });
                        
                        highlightSyntaxCheckbox.addEventListener('change', () => {
                            const vscode = acquireVsCodeApi();
                            vscode.postMessage({
                                command: 'setPreviewOption',
                                option: 'highlightSyntax',
                                value: highlightSyntaxCheckbox.checked
                            });
                        });
                        
                        showAnnotationsCheckbox.addEventListener('change', () => {
                            const vscode = acquireVsCodeApi();
                            vscode.postMessage({
                                command: 'setPreviewOption',
                                option: 'showAnnotations',
                                value: showAnnotationsCheckbox.checked
                            });
                        });
                    }());
                </script>
            </body>
            </html>
        `;
    }
    
    /**
     * Get placeholder HTML for the webview
     * @returns Placeholder HTML content
     */
    private _getPlaceholderHtml(): string {
        // Get webview URI for the CSS
        const styleUri = this._view!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'previewEnhancer.css')
        );
        
        // Get webview URI for responsive CSS
        const responsiveUri = this._view!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'responsive.css')
        );
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="${styleUri}">
                <link rel="stylesheet" href="${responsiveUri}">
                <style>
                    .preview-placeholder {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        text-align: center;
                        padding: 20px;
                    }
                    
                    .preview-placeholder h2 {
                        margin-bottom: 10px;
                    }
                    
                    .preview-placeholder p {
                        margin-bottom: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="preview-placeholder">
                    <h2>Document Preview</h2>
                    <p>Open a document to see a preview</p>
                </div>
            </body>
            </html>
        `;
    }
    
    /**
     * Get error HTML for the webview
     * @param error The error
     * @returns Error HTML content
     */
    private _getErrorHtml(error: unknown): string {
        // Get webview URI for the CSS
        const styleUri = this._view!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'previewEnhancer.css')
        );
        
        // Get webview URI for responsive CSS
        const responsiveUri = this._view!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'responsive.css')
        );
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="${styleUri}">
                <link rel="stylesheet" href="${responsiveUri}">
                <style>
                    .error-preview {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                        padding: 20px;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    
                    .error-message {
                        background-color: var(--vscode-inputValidation-errorBackground, #f2dede);
                        color: var(--vscode-inputValidation-errorForeground, #a94442);
                        padding: 15px;
                        border-left: 4px solid var(--vscode-errorForeground, #f44336);
                        margin: 10px 0;
                    }
                    
                    .error-details {
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="error-preview">
                    <h2>Error Generating Preview</h2>
                    <div class="error-message">
                        ${this._escapeHtml(errorMessage)}
                    </div>
                    <div class="error-details">
                        <p>There was an error generating the preview. Please check the following:</p>
                        <ul>
                            <li>The document format is supported.</li>
                            <li>The document content is valid.</li>
                            <li>Required dependencies are installed.</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
    
    /**
     * Handle messages from the webview
     * @param message The message
     */
    private _handleMessage(message: any): void {
        // Handle different commands
        switch (message.command) {
            case 'setTargetFormat':
                this._setTargetFormat(message.format);
                break;
                
            case 'setPreviewOption':
                this._setPreviewOption(message.option, message.value);
                break;
                
            case 'exportDocument':
                this._exportDocument(message.format);
                break;
                
            case 'printDocument':
                this._printDocument();
                break;
        }
    }
    
    /**
     * Set the target format
     * @param format The target format
     */
    private _setTargetFormat(format: string): void {
        // Set target format based on string value
        switch (format) {
            case 'markdown':
                this._targetFormat = DocumentFormat.MARKDOWN;
                break;
                
            case 'html':
                this._targetFormat = DocumentFormat.HTML;
                break;
                
            case 'text':
                this._targetFormat = DocumentFormat.TEXT;
                break;
                
            case 'docx':
                this._targetFormat = DocumentFormat.DOCX;
                break;
                
            case 'pdf':
                this._targetFormat = DocumentFormat.PDF;
                break;
                
            default:
                this._targetFormat = DocumentFormat.HTML;
                break;
        }
        
        // Update preview
        this._updatePreview();
    }
    
    /**
     * Set a preview option
     * @param option The option name
     * @param value The option value
     */
    private _setPreviewOption(option: string, value: boolean): void {
        // Set preview option
        switch (option) {
            case 'interactive':
                this._previewOptions.interactive = value;
                break;
                
            case 'renderMath':
                this._previewOptions.renderMath = value;
                break;
                
            case 'renderDiagrams':
                this._previewOptions.renderDiagrams = value;
                break;
                
            case 'highlightSyntax':
                this._previewOptions.highlightSyntax = value;
                break;
                
            case 'showAnnotations':
                this._previewOptions.showAnnotations = value;
                break;
        }
        
        // Update preview
        this._updatePreview();
    }
    
    /**
     * Export the document to a file
     * @param format The target format
     */
    private async _exportDocument(format: string): Promise<void> {
        // Check if document is available
        if (!this._currentDocument) {
            vscode.window.showErrorMessage('No document is open for export');
            return;
        }
        
        try {
            // Determine target format
            let targetFormat: DocumentFormat;
            
            switch (format) {
                case 'markdown':
                    targetFormat = DocumentFormat.MARKDOWN;
                    break;
                    
                case 'html':
                    targetFormat = DocumentFormat.HTML;
                    break;
                    
                case 'text':
                    targetFormat = DocumentFormat.TEXT;
                    break;
                    
                case 'docx':
                    targetFormat = DocumentFormat.DOCX;
                    break;
                    
                case 'pdf':
                    targetFormat = DocumentFormat.PDF;
                    break;
                    
                default:
                    targetFormat = DocumentFormat.HTML;
                    break;
            }
            
            // Get file extension for target format
            const extension = ExportUtils.getFileExtension(targetFormat);
            
            // Create suggested file name based on current document
            const currentFileName = path.basename(this._currentDocument.fileName, path.extname(this._currentDocument.fileName));
            const suggestedFileName = `${currentFileName}${extension}`;
            
            // Show save dialog
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(suggestedFileName),
                filters: {
                    'All Files': ['*']
                }
            });
            
            if (!saveUri) {
                return;
            }
            
            // Get output path
            const outputPath = saveUri.fsPath;
            
            // Validate output path
            const validPath = this._pathSafetyUtils.resolveDocumentPath(outputPath, 'document export');
            if (!validPath) {
                vscode.window.showErrorMessage('Invalid export path');
                return;
            }
            
            // Get document content
            const content = this._currentDocument.getText();
            
            // Export document
            const result = await this._formatConverter.exportToFile(
                content,
                this._currentFormat,
                targetFormat,
                {
                    outputPath: validPath,
                    openAfterExport: true,
                    preserveFormatting: true,
                    includeStyles: true
                }
            );
            
            if (result.success) {
                vscode.window.showInformationMessage(`Document exported to ${path.basename(result.filePath!)}`);
            } else {
                vscode.window.showErrorMessage(`Failed to export document: ${result.error}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Print the document
     */
    private async _printDocument(): Promise<void> {
        // Check if view is available
        if (!this._view) {
            return;
        }
        
        // Send print command to webview
        this._view.webview.postMessage({ command: 'print' });
    }
    
    /**
     * Register preview commands
     * @param context The extension context
     */
    public static registerCommands(context: vscode.ExtensionContext): void {
        // Register export document command
        context.subscriptions.push(
            vscode.commands.registerCommand('document-writer.exportDocument', async (format: string) => {
                // Get preview provider
                const provider = DocumentPreviewProvider.getProvider();
                
                if (provider) {
                    // Export document
                    await provider._exportDocument(format);
                }
            })
        );
        
        // Register print document command
        context.subscriptions.push(
            vscode.commands.registerCommand('document-writer.printDocument', () => {
                // Get preview provider
                const provider = DocumentPreviewProvider.getProvider();
                
                if (provider) {
                    // Print document
                    provider._printDocument();
                }
            })
        );
        
        // Register refresh preview command
        context.subscriptions.push(
            vscode.commands.registerCommand('document-writer.refreshPreview', () => {
                // Get preview provider
                const provider = DocumentPreviewProvider.getProvider();
                
                if (provider) {
                    // Update preview
                    provider._updatePreview();
                }
            })
        );
    }
    
    // Static instance for accessing the provider
    private static _instance: DocumentPreviewProvider | undefined;
    
    /**
     * Register the provider
     * @param context The extension context
     * @returns The provider instance
     */
    public static register(context: vscode.ExtensionContext): DocumentPreviewProvider {
        // Create provider
        const provider = new DocumentPreviewProvider(context.extensionUri);
        
        // Register provider
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                DocumentPreviewProvider.viewType,
                provider
            )
        );
        
        // Register commands
        DocumentPreviewProvider.registerCommands(context);
        
        // Set instance
        DocumentPreviewProvider._instance = provider;
        
        return provider;
    }
    
    /**
     * Get the provider instance
     * @returns The provider instance
     */
    public static getProvider(): DocumentPreviewProvider | undefined {
        return DocumentPreviewProvider._instance;
    }
    
    /**
     * Handle PDF preview
     * @param content The PDF content or path
     */
    private async _handlePdfPreview(content: string): Promise<void> {
        if (!this._view) {
            return;
        }

        try {
            // Use our PDFPreviewProvider for enhanced PDF preview
            const previewOptions = {
                maxPages: 5,
                includeThumbnails: true,
                zoomLevel: 1.0,
                includeMetadata: true
            };

            // Generate the PDF preview
            const previewResult = await this._pdfPreviewProvider.generatePreview(content, previewOptions);

            if (previewResult.success) {
                // Update webview with the generated HTML
                const enhancedHtml = this._enhanceHtmlForWebview(previewResult.html);
                this._view.webview.html = enhancedHtml;

                // Clean up temporary files after a delay
                if (previewResult.temporaryFiles && previewResult.temporaryFiles.length > 0) {
                    setTimeout(() => {
                        this._pdfPreviewProvider.cleanupTemporaryFiles(previewResult.temporaryFiles || [])
                            .catch(error => console.warn('Error cleaning up temporary PDF files:', error));
                    }, 60000); // Clean up after 1 minute
                }
            } else {
                // Show error in preview
                this._view.webview.html = this._getErrorHtml(
                    new Error(previewResult.error || 'Failed to generate PDF preview')
                );
            }
        } catch (error) {
            console.error('Error handling PDF preview:', error);
            this._view.webview.html = this._getErrorHtml(error);
        }
    }

    /**
     * Escape HTML special characters
     * @param text The text to escape
     * @returns Escaped text
     */
    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
