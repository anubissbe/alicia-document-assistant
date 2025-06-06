import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { DocumentService } from '../services/documentService';
import { StatusBarManager } from './statusBarManager';

export interface ShareData {
    version: string;
    documentId: string;
    title: string;
    type: string;
    content: string;
    author?: string;
    createdAt: string;
    expiresAt?: string;
    readOnly: boolean;
    compressed?: boolean;
}

export interface ShareOptions {
    expirationHours?: number;
    readOnly?: boolean;
    includeMetadata?: boolean;
    compress?: boolean;
}

export class DocumentShareProvider {
    private static readonly SHARE_VERSION = '1.0';
    private static readonly DEFAULT_EXPIRATION_HOURS = 24 * 7; // 1 week
    private sharedDocuments: Map<string, ShareData> = new Map();
    private shareServer?: vscode.WebviewPanel;

    constructor(
        private context: vscode.ExtensionContext,
        private documentService: DocumentService,
        private statusBarManager?: StatusBarManager
    ) {
        this.registerCommands();
        this.loadSharedDocuments();
    }

    private registerCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('documentWriter.shareDocument', () => {
                this.shareCurrentDocument();
            }),
            vscode.commands.registerCommand('documentWriter.viewSharedDocuments', () => {
                this.viewSharedDocuments();
            }),
            vscode.commands.registerCommand('documentWriter.openSharedDocument', (shareId: string) => {
                this.openSharedDocument(shareId);
            })
        );
    }

    /**
     * Share the current document
     */
    public async shareCurrentDocument(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active document to share');
                return;
            }

            // Get share options
            const options = await this.getShareOptions();
            if (!options) {
                return;
            }

            // Show progress
            if (this.statusBarManager) {
                this.statusBarManager.showProgress('Generating share link...');
            }

            // Create share data
            const shareId = this.generateShareId();
            const document = editor.document;
            const content = document.getText();
            
            const shareData: ShareData = {
                version: DocumentShareProvider.SHARE_VERSION,
                documentId: shareId,
                title: this.getDocumentTitle(document),
                type: this.getDocumentType(document),
                content: options.compress ? this.compressContent(content) : content,
                author: vscode.workspace.getConfiguration('documentWriter').get('defaultAuthor'),
                createdAt: new Date().toISOString(),
                expiresAt: this.calculateExpiration(options.expirationHours),
                readOnly: options.readOnly ?? true,
                compressed: options.compress
            };

            // Store share data
            this.sharedDocuments.set(shareId, shareData);
            await this.saveSharedDocuments();

            // Generate share link
            const shareLink = this.generateShareLink(shareId);

            if (this.statusBarManager) {
                this.statusBarManager.hideProgress();
            }

            // Show share dialog
            this.showShareDialog(shareData, shareLink);

        } catch (error) {
            if (this.statusBarManager) {
                this.statusBarManager.hideProgress();
            }
            console.error('Share document error:', error);
            vscode.window.showErrorMessage(`Failed to share document: ${error}`);
        }
    }

    /**
     * Get share options from user
     */
    private async getShareOptions(): Promise<ShareOptions | undefined> {
        const expirationOptions = [
            { label: '1 hour', hours: 1 },
            { label: '24 hours', hours: 24 },
            { label: '7 days', hours: 24 * 7 },
            { label: '30 days', hours: 24 * 30 },
            { label: 'Never expire', hours: 0 }
        ];

        const expiration = await vscode.window.showQuickPick(
            expirationOptions.map(opt => ({
                label: opt.label,
                detail: opt.hours === 0 ? 'Link will never expire' : `Link expires in ${opt.label}`,
                hours: opt.hours
            })),
            { placeHolder: 'Select link expiration' }
        );

        if (!expiration) {
            return undefined;
        }

        const permissions = await vscode.window.showQuickPick([
            { label: 'Read-only', value: true, description: 'Recipients can only view the document' },
            { label: 'Editable', value: false, description: 'Recipients can edit the document (requires collaboration server)' }
        ], { placeHolder: 'Select sharing permissions' });

        if (!permissions) {
            return undefined;
        }

        return {
            expirationHours: expiration.hours,
            readOnly: permissions.value,
            compress: true,
            includeMetadata: true
        };
    }

    /**
     * Generate unique share ID
     */
    private generateShareId(): string {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Generate share link
     */
    private generateShareLink(shareId: string): string {
        // In a real implementation, this would be a public URL
        // For now, we'll use a command URI that VS Code can handle
        const baseUri = vscode.env.asExternalUri(vscode.Uri.parse(`vscode://document-writer/shared/${shareId}`));
        return baseUri.toString();
    }

    /**
     * Show share dialog
     */
    private showShareDialog(shareData: ShareData, shareLink: string): void {
        const panel = vscode.window.createWebviewPanel(
            'documentShare',
            `Share: ${shareData.title}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getShareDialogHtml(shareData, shareLink);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'copy':
                        await vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Link copied to clipboard!');
                        break;
                    case 'email':
                        const mailto = `mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(`Check out this document:\n\n${shareLink}`)}`;
                        await vscode.env.openExternal(vscode.Uri.parse(mailto));
                        break;
                    case 'qr':
                        // Generate QR code (would need a QR library)
                        vscode.window.showInformationMessage('QR code generation requires additional setup');
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Get share dialog HTML
     */
    private getShareDialogHtml(shareData: ShareData, shareLink: string): string {
        const expirationText = shareData.expiresAt 
            ? `Expires: ${new Date(shareData.expiresAt).toLocaleString()}`
            : 'Never expires';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 20px;
                    line-height: 1.6;
                }
                h1 {
                    color: var(--vscode-foreground);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 10px;
                }
                .share-link-container {
                    display: flex;
                    gap: 10px;
                    margin: 20px 0;
                }
                .share-link-input {
                    flex: 1;
                    padding: 8px 12px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                    font-family: monospace;
                    font-size: 12px;
                }
                button {
                    padding: 8px 16px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 13px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .share-buttons {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin: 20px 0;
                }
                .info-box {
                    background: var(--vscode-textBlockQuote-background);
                    border-left: 3px solid var(--vscode-textLink-foreground);
                    padding: 10px 15px;
                    margin: 20px 0;
                }
                .metadata {
                    margin: 20px 0;
                    padding: 15px;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                }
                .metadata-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 0;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .metadata-item:last-child {
                    border-bottom: none;
                }
            </style>
        </head>
        <body>
            <h1>🔗 Share Document</h1>
            
            <div class="share-link-container">
                <input type="text" class="share-link-input" id="shareLink" value="${shareLink}" readonly>
                <button onclick="copyLink()">📋 Copy</button>
            </div>
            
            <div class="share-buttons">
                <button onclick="shareViaEmail()">📧 Share via Email</button>
                <button onclick="generateQR()">📱 Generate QR Code</button>
            </div>
            
            <div class="info-box">
                <strong>ℹ️ Share Information</strong><br>
                ${expirationText}<br>
                Permissions: ${shareData.readOnly ? 'Read-only' : 'Editable'}<br>
                ${shareData.compressed ? 'Content is compressed' : 'Full content included'}
            </div>
            
            <div class="metadata">
                <h3>Document Details</h3>
                <div class="metadata-item">
                    <span>Title:</span>
                    <span>${shareData.title}</span>
                </div>
                <div class="metadata-item">
                    <span>Type:</span>
                    <span>${shareData.type}</span>
                </div>
                <div class="metadata-item">
                    <span>Author:</span>
                    <span>${shareData.author || 'Unknown'}</span>
                </div>
                <div class="metadata-item">
                    <span>Created:</span>
                    <span>${new Date(shareData.createdAt).toLocaleString()}</span>
                </div>
                <div class="metadata-item">
                    <span>Share ID:</span>
                    <span style="font-family: monospace; font-size: 11px;">${shareData.documentId}</span>
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function copyLink() {
                    const link = document.getElementById('shareLink').value;
                    vscode.postMessage({ command: 'copy', text: link });
                }
                
                function shareViaEmail() {
                    vscode.postMessage({ command: 'email' });
                }
                
                function generateQR() {
                    vscode.postMessage({ command: 'qr' });
                }
            </script>
        </body>
        </html>
        `;
    }

    /**
     * View all shared documents
     */
    public async viewSharedDocuments(): Promise<void> {
        // Remove expired documents
        this.cleanupExpiredShares();

        const items: vscode.QuickPickItem[] = Array.from(this.sharedDocuments.entries()).map(([id, data]) => ({
            label: data.title,
            description: `Shared ${this.getTimeAgo(new Date(data.createdAt))}`,
            detail: `${data.readOnly ? 'Read-only' : 'Editable'} • ${data.expiresAt ? `Expires ${this.getTimeAgo(new Date(data.expiresAt))}` : 'Never expires'}`,
            id
        }));

        if (items.length === 0) {
            vscode.window.showInformationMessage('No shared documents');
            return;
        }

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a shared document to open'
        });

        if (selection && selection.id) {
            await this.openSharedDocument(selection.id);
        }
    }

    /**
     * Open a shared document
     */
    public async openSharedDocument(shareId: string): Promise<void> {
        const shareData = this.sharedDocuments.get(shareId);
        if (!shareData) {
            vscode.window.showErrorMessage('Shared document not found or expired');
            return;
        }

        // Check expiration
        if (shareData.expiresAt && new Date(shareData.expiresAt) < new Date()) {
            this.sharedDocuments.delete(shareId);
            await this.saveSharedDocuments();
            vscode.window.showErrorMessage('This share link has expired');
            return;
        }

        // Create temporary file for shared content
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const fileName = `shared_${shareData.title.replace(/[^a-z0-9]/gi, '_')}.${shareData.type}`;
        const uri = workspaceFolder 
            ? vscode.Uri.joinPath(workspaceFolder.uri, '.shared', fileName)
            : vscode.Uri.file(fileName);

        const content = shareData.compressed ? this.decompressContent(shareData.content) : shareData.content;
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(uri, encoder.encode(content));

        // Open document
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);

        if (shareData.readOnly) {
            vscode.window.showInformationMessage('This is a read-only shared document');
        }
    }

    /**
     * Compress content for sharing
     */
    private compressContent(content: string): string {
        // Basic compression: remove extra whitespace
        return content
            .replace(/\s+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    /**
     * Decompress content
     */
    private decompressContent(content: string): string {
        // Since we only did basic compression, no decompression needed
        return content;
    }

    /**
     * Get document title
     */
    private getDocumentTitle(document: vscode.TextDocument): string {
        const fileName = document.fileName;
        return fileName.substring(fileName.lastIndexOf('/') + 1, fileName.lastIndexOf('.')) || 'Untitled';
    }

    /**
     * Get document type
     */
    private getDocumentType(document: vscode.TextDocument): string {
        const ext = document.fileName.substring(document.fileName.lastIndexOf('.') + 1);
        return ext || 'txt';
    }

    /**
     * Calculate expiration date
     */
    private calculateExpiration(hours?: number): string | undefined {
        if (!hours || hours === 0) {
            return undefined;
        }
        const date = new Date();
        date.setHours(date.getHours() + hours);
        return date.toISOString();
    }

    /**
     * Get human-readable time ago
     */
    private getTimeAgo(date: Date): string {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'just now';
    }

    /**
     * Load shared documents from storage
     */
    private async loadSharedDocuments(): Promise<void> {
        const stored = this.context.globalState.get<[string, ShareData][]>('sharedDocuments');
        if (stored) {
            this.sharedDocuments = new Map(stored);
            this.cleanupExpiredShares();
        }
    }

    /**
     * Save shared documents to storage
     */
    private async saveSharedDocuments(): Promise<void> {
        const toStore = Array.from(this.sharedDocuments.entries());
        await this.context.globalState.update('sharedDocuments', toStore);
    }

    /**
     * Cleanup expired shares
     */
    private cleanupExpiredShares(): void {
        const now = new Date();
        const expired: string[] = [];

        this.sharedDocuments.forEach((data, id) => {
            if (data.expiresAt && new Date(data.expiresAt) < now) {
                expired.push(id);
            }
        });

        expired.forEach(id => this.sharedDocuments.delete(id));
        
        if (expired.length > 0) {
            this.saveSharedDocuments();
        }
    }

    /**
     * Dispose
     */
    public dispose(): void {
        // Save any pending changes
        this.saveSharedDocuments();
    }
}