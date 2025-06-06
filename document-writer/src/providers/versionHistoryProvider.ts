import * as vscode from 'vscode';
import * as path from 'path';
import { DocumentService } from '../services/documentService';
import { StatusBarManager } from './statusBarManager';

export interface DocumentVersion {
    id: string;
    name: string;
    timestamp: Date;
    filePath: string;
    content: string;
    metadata: {
        title?: string;
        author?: string;
        wordCount: number;
        characterCount: number;
        hash: string;
    };
    diff?: {
        additions: number;
        deletions: number;
        changes: string[];
    };
}

export class VersionHistoryProvider implements vscode.TreeDataProvider<DocumentVersion> {
    private _onDidChangeTreeData: vscode.EventEmitter<DocumentVersion | undefined | null | void> = new vscode.EventEmitter<DocumentVersion | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DocumentVersion | undefined | null | void> = this._onDidChangeTreeData.event;

    private versions: Map<string, DocumentVersion[]> = new Map();
    private readonly maxVersionsPerDocument = 20;
    private treeView: vscode.TreeView<DocumentVersion>;
    private gitExtension?: vscode.Extension<any>;

    constructor(
        private context: vscode.ExtensionContext,
        private documentService: DocumentService,
        private statusBarManager?: StatusBarManager
    ) {
        // Register tree view
        this.treeView = vscode.window.createTreeView('documentWriter.versionHistory', {
            treeDataProvider: this,
            showCollapseAll: true
        });
        context.subscriptions.push(this.treeView);

        // Try to get Git extension
        this.gitExtension = vscode.extensions.getExtension('vscode.git');

        this.registerCommands();
        this.registerEventListeners();
        this.loadVersionHistory();
    }

    private registerCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('documentWriter.saveVersion', () => {
                this.saveCurrentVersion();
            }),
            vscode.commands.registerCommand('documentWriter.showVersionHistory', () => {
                this.showVersionHistory();
            }),
            vscode.commands.registerCommand('documentWriter.loadVersion', (version: DocumentVersion) => {
                this.loadVersion(version);
            }),
            vscode.commands.registerCommand('documentWriter.compareVersions', (version: DocumentVersion) => {
                this.compareWithCurrent(version);
            }),
            vscode.commands.registerCommand('documentWriter.deleteVersion', (version: DocumentVersion) => {
                this.deleteVersion(version);
            }),
            vscode.commands.registerCommand('documentWriter.renameVersion', (version: DocumentVersion) => {
                this.renameVersion(version);
            })
        );
    }

    private registerEventListeners(): void {
        // Watch for document saves
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (this.isTrackedDocument(document)) {
                this.autoSaveVersion(document);
            }
        });

        // Watch for Git commits if available
        if (this.gitExtension && this.gitExtension.isActive) {
            this.setupGitIntegration();
        }
    }

    /**
     * Save current document as a version
     */
    public async saveCurrentVersion(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active document to save');
            return;
        }

        const document = editor.document;
        if (!this.isTrackedDocument(document)) {
            vscode.window.showWarningMessage('This document type is not tracked for version history');
            return;
        }

        // Get version name from user
        const versionName = await vscode.window.showInputBox({
            prompt: 'Enter version name',
            placeHolder: 'e.g., First draft, Major revision, Final version',
            value: `Version ${this.getVersionCount(document.fileName) + 1}`
        });

        if (!versionName) {
            return;
        }

        // Show progress
        if (this.statusBarManager) {
            this.statusBarManager.showProgress('Saving version...');
        }

        try {
            const version = await this.createVersion(document, versionName);
            this.addVersion(document.fileName, version);
            await this.saveVersionHistory();

            if (this.statusBarManager) {
                this.statusBarManager.hideProgress();
            }

            vscode.window.showInformationMessage(`Version "${versionName}" saved successfully`);
            this._onDidChangeTreeData.fire();

        } catch (error) {
            if (this.statusBarManager) {
                this.statusBarManager.hideProgress();
            }
            console.error('Save version error:', error);
            vscode.window.showErrorMessage(`Failed to save version: ${error}`);
        }
    }

    /**
     * Show version history for current document
     */
    public async showVersionHistory(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active document');
            return;
        }

        const versions = this.versions.get(editor.document.fileName) || [];
        if (versions.length === 0) {
            vscode.window.showInformationMessage('No version history for this document');
            return;
        }

        // Show in tree view
        this.treeView.reveal(versions[0], { select: true, focus: true });

        // Also show quick pick for easy selection
        const items = versions.map(v => ({
            label: v.name,
            description: `${new Date(v.timestamp).toLocaleString()} • ${v.metadata.wordCount} words`,
            detail: v.metadata.title || path.basename(v.filePath),
            version: v
        }));

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a version to load or compare'
        });

        if (selection) {
            const action = await vscode.window.showQuickPick([
                { label: '$(eye) View', value: 'view' },
                { label: '$(diff) Compare with current', value: 'compare' },
                { label: '$(check) Load this version', value: 'load' },
                { label: '$(trash) Delete', value: 'delete' }
            ], { placeHolder: 'What would you like to do?' });

            if (action) {
                switch (action.value) {
                    case 'view':
                        await this.viewVersion(selection.version);
                        break;
                    case 'compare':
                        await this.compareWithCurrent(selection.version);
                        break;
                    case 'load':
                        await this.loadVersion(selection.version);
                        break;
                    case 'delete':
                        await this.deleteVersion(selection.version);
                        break;
                }
            }
        }
    }

    /**
     * Load a specific version
     */
    private async loadVersion(version: DocumentVersion): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `Load version "${version.name}"? Current changes will be replaced.`,
            'Load Version',
            'Cancel'
        );

        if (confirm !== 'Load Version') {
            return;
        }

        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                // Open new document
                const doc = await vscode.workspace.openTextDocument({
                    content: version.content,
                    language: this.getLanguageId(version.filePath)
                });
                await vscode.window.showTextDocument(doc);
            } else {
                // Replace current content
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(editor.document.getText().length)
                );
                edit.replace(editor.document.uri, fullRange, version.content);
                await vscode.workspace.applyEdit(edit);
            }

            vscode.window.showInformationMessage(`Loaded version "${version.name}"`);
        } catch (error) {
            console.error('Load version error:', error);
            vscode.window.showErrorMessage(`Failed to load version: ${error}`);
        }
    }

    /**
     * Compare version with current document
     */
    private async compareWithCurrent(version: DocumentVersion): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active document to compare with');
            return;
        }

        try {
            // Create temporary file for version content
            const tempUri = vscode.Uri.parse(`document-writer-version:${version.id}/${version.name}`);
            
            // Register content provider for virtual document
            const provider = new class implements vscode.TextDocumentContentProvider {
                provideTextDocumentContent(): string {
                    return version.content;
                }
            };

            const disposable = vscode.workspace.registerTextDocumentContentProvider('document-writer-version', provider);
            this.context.subscriptions.push(disposable);

            // Open diff view
            await vscode.commands.executeCommand(
                'vscode.diff',
                tempUri,
                editor.document.uri,
                `${version.name} ↔ Current`
            );

        } catch (error) {
            console.error('Compare versions error:', error);
            vscode.window.showErrorMessage(`Failed to compare versions: ${error}`);
        }
    }

    /**
     * View a specific version
     */
    private async viewVersion(version: DocumentVersion): Promise<void> {
        const doc = await vscode.workspace.openTextDocument({
            content: version.content,
            language: this.getLanguageId(version.filePath)
        });
        
        await vscode.window.showTextDocument(doc, {
            preview: true,
            viewColumn: vscode.ViewColumn.Beside
        });

        vscode.window.showInformationMessage(`Viewing version "${version.name}" (read-only)`);
    }

    /**
     * Delete a version
     */
    private async deleteVersion(version: DocumentVersion): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `Delete version "${version.name}"?`,
            'Delete',
            'Cancel'
        );

        if (confirm !== 'Delete') {
            return;
        }

        const versions = this.versions.get(version.filePath) || [];
        const index = versions.findIndex(v => v.id === version.id);
        
        if (index !== -1) {
            versions.splice(index, 1);
            await this.saveVersionHistory();
            this._onDidChangeTreeData.fire();
            vscode.window.showInformationMessage(`Deleted version "${version.name}"`);
        }
    }

    /**
     * Rename a version
     */
    private async renameVersion(version: DocumentVersion): Promise<void> {
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new version name',
            value: version.name,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Version name cannot be empty';
                }
                return null;
            }
        });

        if (!newName || newName === version.name) {
            return;
        }

        version.name = newName;
        await this.saveVersionHistory();
        this._onDidChangeTreeData.fire();
        vscode.window.showInformationMessage(`Renamed version to "${newName}"`);
    }

    /**
     * Auto-save version on significant changes
     */
    private async autoSaveVersion(document: vscode.TextDocument): Promise<void> {
        const versions = this.versions.get(document.fileName) || [];
        const lastVersion = versions[0];

        if (lastVersion) {
            // Check for significant changes
            const currentContent = document.getText();
            const wordCount = this.getWordCount(currentContent);
            const lastWordCount = lastVersion.metadata.wordCount;
            const wordDiff = Math.abs(wordCount - lastWordCount);

            // Auto-save if more than 500 words changed or 20% change
            const percentChange = Math.abs((wordCount - lastWordCount) / lastWordCount) * 100;
            if (wordDiff > 500 || percentChange > 20) {
                const version = await this.createVersion(document, `Auto-save ${new Date().toLocaleTimeString()}`);
                this.addVersion(document.fileName, version);
                await this.saveVersionHistory();
                this._onDidChangeTreeData.fire();
            }
        }
    }

    /**
     * Create a version from document
     */
    private async createVersion(document: vscode.TextDocument, name: string): Promise<DocumentVersion> {
        const content = document.getText();
        const crypto = await import('crypto');
        
        return {
            id: Date.now().toString(),
            name,
            timestamp: new Date(),
            filePath: document.fileName,
            content,
            metadata: {
                title: path.basename(document.fileName, path.extname(document.fileName)),
                author: vscode.workspace.getConfiguration('documentWriter').get('defaultAuthor'),
                wordCount: this.getWordCount(content),
                characterCount: content.length,
                hash: crypto.createHash('md5').update(content).digest('hex')
            }
        };
    }

    /**
     * Add version to history
     */
    private addVersion(filePath: string, version: DocumentVersion): void {
        const versions = this.versions.get(filePath) || [];
        versions.unshift(version);

        // Limit versions per document
        if (versions.length > this.maxVersionsPerDocument) {
            versions.splice(this.maxVersionsPerDocument);
        }

        this.versions.set(filePath, versions);
    }

    /**
     * Setup Git integration
     */
    private async setupGitIntegration(): Promise<void> {
        // This would integrate with Git to track commits as versions
        // For now, it's a placeholder for future enhancement
        console.log('Git integration for version history initialized');
    }

    /**
     * Check if document should be tracked
     */
    private isTrackedDocument(document: vscode.TextDocument): boolean {
        const trackedExtensions = ['.md', '.txt', '.html', '.docx'];
        return trackedExtensions.some(ext => document.fileName.endsWith(ext));
    }

    /**
     * Get language ID for file
     */
    private getLanguageId(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
            case '.md': return 'markdown';
            case '.html': return 'html';
            case '.txt': return 'plaintext';
            default: return 'plaintext';
        }
    }

    /**
     * Get word count
     */
    private getWordCount(content: string): number {
        return content.trim().split(/\s+/).filter(w => w.length > 0).length;
    }

    /**
     * Get version count for document
     */
    private getVersionCount(filePath: string): number {
        return (this.versions.get(filePath) || []).length;
    }

    /**
     * Load version history from storage
     */
    private async loadVersionHistory(): Promise<void> {
        const stored = this.context.globalState.get<[string, DocumentVersion[]][]>('versionHistory');
        if (stored) {
            this.versions = new Map(stored.map(([k, v]) => [k, v.map(ver => ({
                ...ver,
                timestamp: new Date(ver.timestamp)
            }))]));
        }
    }

    /**
     * Save version history to storage
     */
    private async saveVersionHistory(): Promise<void> {
        const toStore = Array.from(this.versions.entries());
        await this.context.globalState.update('versionHistory', toStore);
    }

    // TreeDataProvider implementation
    getTreeItem(element: DocumentVersion): vscode.TreeItem {
        const item = new vscode.TreeItem(
            element.name,
            vscode.TreeItemCollapsibleState.None
        );
        
        item.description = new Date(element.timestamp).toLocaleString();
        item.tooltip = `${element.metadata.wordCount} words • ${element.metadata.characterCount} characters`;
        item.contextValue = 'version';
        
        item.command = {
            command: 'documentWriter.compareVersions',
            title: 'Compare with Current',
            arguments: [element]
        };

        return item;
    }

    getChildren(element?: DocumentVersion): Thenable<DocumentVersion[]> {
        if (!element) {
            // Return all versions for current document
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const versions = this.versions.get(editor.document.fileName) || [];
                return Promise.resolve(versions);
            }
        }
        return Promise.resolve([]);
    }

    /**
     * Dispose
     */
    public dispose(): void {
        this.saveVersionHistory();
    }
}