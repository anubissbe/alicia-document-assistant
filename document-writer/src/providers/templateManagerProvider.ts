import * as vscode from 'vscode';
import * as path from 'path';
import { TemplateManagerService } from '../services/templateManagerService';

/**
 * Provider for the template manager webview
 */
export class TemplateManagerProvider {
    private _panel: vscode.WebviewPanel | undefined;
    private _extensionUri: vscode.Uri;
    private _templateService: TemplateManagerService;
    
    /**
     * Constructor
     * @param extensionUri The URI of the extension
     * @param templateService The template service
     */
    constructor(
        extensionUri: vscode.Uri,
        templateService: TemplateManagerService
    ) {
        this._extensionUri = extensionUri;
        this._templateService = templateService;
    }
    
    /**
     * Show the template manager
     */
    public async show() {
        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.One);
            return;
        }
        
        this._panel = vscode.window.createWebviewPanel(
            'templateManager',
            'Template Manager',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'media'),
                    vscode.Uri.joinPath(this._extensionUri, 'resources'),
                ]
            }
        );
        
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        
        this._setWebviewMessageListener(this._panel.webview);
        
        this._panel.onDidDispose(() => {
            this._panel = undefined;
        });
    }
    
    /**
     * Get the HTML for the webview
     * @param webview The webview
     * @returns The HTML for the webview
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'templateManager.js')
        );
        
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'templateManager.css')
        );
        
        const nonce = this._getNonce();
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Template Manager</title>
        </head>
        <body>
            <div class="manager-container">
                <div class="manager-header">
                    <div class="search-container">
                        <input type="text" id="search-input" placeholder="Search templates..." class="search-input">
                    </div>
                    <div class="action-buttons">
                        <button id="create-template-button" class="action-button">Create Template</button>
                        <button id="import-template-button" class="action-button">Import Template</button>
                    </div>
                </div>
                
                <div class="manager-body">
                    <div id="category-tabs" class="category-tabs">
                        <!-- Category tabs will be dynamically inserted here -->
                    </div>
                    
                    <div id="main-content" class="main-content">
                        <!-- Template list or details will be dynamically inserted here -->
                    </div>
                </div>
                
                <div id="error-container" class="error-container"></div>
            </div>
            
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
    
    /**
     * Set up the webview message listener
     * @param webview The webview
     */
    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'getTemplates':
                        // Send templates to webview
                        try {
                            const templates = await this._templateService.getTemplates();
                            webview.postMessage({
                                command: 'templatesLoaded',
                                templates: templates
                            });
                        } catch (error) {
                            webview.postMessage({
                                command: 'error',
                                message: `Error loading templates: ${error instanceof Error ? error.message : String(error)}`
                            });
                        }
                        break;
                        
                    case 'saveTemplate':
                        // Save template
                        try {
                            if (message.template) {
                                const savedTemplate = await this._templateService.saveTemplate(message.template);
                                webview.postMessage({
                                    command: 'templateSaved',
                                    template: savedTemplate
                                });
                            }
                        } catch (error) {
                            webview.postMessage({
                                command: 'error',
                                message: `Error saving template: ${error instanceof Error ? error.message : String(error)}`
                            });
                        }
                        break;
                        
                    case 'deleteTemplate':
                        // Delete template
                        try {
                            if (message.templateId) {
                                await this._templateService.deleteTemplate(message.templateId);
                                webview.postMessage({
                                    command: 'templateDeleted',
                                    templateId: message.templateId
                                });
                            }
                        } catch (error) {
                            webview.postMessage({
                                command: 'error',
                                message: `Error deleting template: ${error instanceof Error ? error.message : String(error)}`
                            });
                        }
                        break;
                        
                    case 'useTemplate':
                        // Use template to create a new document
                        try {
                            if (message.templateId) {
                                // Close template manager
                                if (this._panel) {
                                    this._panel.dispose();
                                }
                                
                                // Open document wizard with selected template
                                vscode.commands.executeCommand('document-writer.createDocumentFromTemplate', message.templateId);
                            }
                        } catch (error) {
                            webview.postMessage({
                                command: 'error',
                                message: `Error using template: ${error instanceof Error ? error.message : String(error)}`
                            });
                        }
                        break;
                        
                    case 'exportTemplate':
                        // Export template to file
                        try {
                            if (message.templateId) {
                                const exportPath = await this._templateService.exportTemplate(message.templateId);
                                
                                if (exportPath) {
                                    vscode.window.showInformationMessage(`Template exported to ${exportPath}`);
                                }
                            }
                        } catch (error) {
                            webview.postMessage({
                                command: 'error',
                                message: `Error exporting template: ${error instanceof Error ? error.message : String(error)}`
                            });
                        }
                        break;
                        
                    case 'importTemplate':
                        // Import template from file
                        try {
                            // Show file picker
                            const result = await vscode.window.showOpenDialog({
                                canSelectFiles: true,
                                canSelectFolders: false,
                                canSelectMany: false,
                                filters: {
                                    'Templates': ['docx', 'md', 'html', 'json'],
                                    'All Files': ['*']
                                },
                                title: 'Import Template'
                            });
                            
                            if (result && result.length > 0) {
                                const importedTemplate = await this._templateService.importTemplate(result[0].fsPath);
                                
                                if (importedTemplate) {
                                    webview.postMessage({
                                        command: 'templateSaved',
                                        template: importedTemplate
                                    });
                                }
                            }
                        } catch (error) {
                            webview.postMessage({
                                command: 'error',
                                message: `Error importing template: ${error instanceof Error ? error.message : String(error)}`
                            });
                        }
                        break;
                        
                    case 'uploadTemplateFile':
                        // Handle template file upload
                        try {
                            if (message.fileName) {
                                // Show file picker
                                const result = await vscode.window.showOpenDialog({
                                    canSelectFiles: true,
                                    canSelectFolders: false,
                                    canSelectMany: false,
                                    filters: {
                                        'Template Files': ['docx', 'md', 'html', 'json'],
                                        'All Files': ['*']
                                    },
                                    title: 'Select Template File'
                                });
                                
                                if (result && result.length > 0) {
                                    // Process the selected file
                                    webview.postMessage({
                                        command: 'fileUploaded',
                                        fileName: result[0].fsPath
                                    });
                                }
                            }
                        } catch (error) {
                            webview.postMessage({
                                command: 'error',
                                message: `Error uploading file: ${error instanceof Error ? error.message : String(error)}`
                            });
                        }
                        break;
                        
                    case 'dropFiles':
                        // Handle dropped files
                        try {
                            // Show file picker since we can't directly access dropped files
                            const result = await vscode.window.showOpenDialog({
                                canSelectFiles: true,
                                canSelectFolders: false,
                                canSelectMany: false,
                                filters: {
                                    'Template Files': ['docx', 'md', 'html', 'json'],
                                    'All Files': ['*']
                                },
                                title: 'Select Template File'
                            });
                            
                            if (result && result.length > 0) {
                                const importedTemplate = await this._templateService.importTemplate(result[0].fsPath);
                                
                                if (importedTemplate) {
                                    webview.postMessage({
                                        command: 'templateSaved',
                                        template: importedTemplate
                                    });
                                    
                                    webview.postMessage({
                                        command: 'fileUploaded'
                                    });
                                }
                            } else {
                                webview.postMessage({
                                    command: 'fileUploaded'
                                });
                            }
                        } catch (error) {
                            webview.postMessage({
                                command: 'error',
                                message: `Error processing dropped files: ${error instanceof Error ? error.message : String(error)}`
                            });
                            
                            webview.postMessage({
                                command: 'fileUploaded'
                            });
                        }
                        break;
                        
                    case 'generatePreview':
                        // Generate template preview
                        try {
                            if (message.templateId) {
                                const previewHtml = await this._templateService.generateTemplatePreview(message.templateId);
                                
                                webview.postMessage({
                                    command: 'templatePreviewGenerated',
                                    templateId: message.templateId,
                                    previewHtml: previewHtml
                                });
                            }
                        } catch (error) {
                            webview.postMessage({
                                command: 'error',
                                message: `Error generating preview: ${error instanceof Error ? error.message : String(error)}`
                            });
                        }
                        break;
                }
            },
            undefined,
            []
        );
    }
    
    /**
     * Generate a nonce
     * @returns A random nonce
     */
    private _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
