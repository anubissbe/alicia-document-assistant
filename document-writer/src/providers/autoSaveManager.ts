import * as vscode from 'vscode';
import { DocumentService } from '../services/documentService';
import { StatusBarManager } from './statusBarManager';

export interface AutoSaveState {
    documentPath?: string;
    content: string;
    timestamp: Date;
    isDirty: boolean;
    metadata?: {
        title?: string;
        type?: string;
        format?: string;
        [key: string]: any;
    };
}

export class AutoSaveManager {
    private static readonly AUTO_SAVE_KEY = 'documentWriter.autoSave';
    private static readonly AUTO_SAVE_INTERVAL = 30000; // 30 seconds
    private static readonly DEBOUNCE_DELAY = 2000; // 2 seconds
    private static readonly MAX_AGE_HOURS = 24; // 24 hours

    private autoSaveTimer?: NodeJS.Timeout;
    private debounceTimer?: NodeJS.Timeout;
    private isDirty: boolean = false;
    private currentDocument?: AutoSaveState;
    private statusBarItem: vscode.StatusBarItem;

    constructor(
        private context: vscode.ExtensionContext,
        private documentService: DocumentService,
        private statusBarManager?: StatusBarManager
    ) {
        // Create status bar item for auto-save indicator
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            50
        );
        this.statusBarItem.text = '$(save) Auto-save enabled';
        this.statusBarItem.tooltip = 'Auto-save is active';
        this.statusBarItem.command = 'documentWriter.toggleAutoSave';
        context.subscriptions.push(this.statusBarItem);

        // Register commands
        this.registerCommands();
        
        // Start auto-save monitoring
        this.start();
    }

    private registerCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('documentWriter.toggleAutoSave', () => {
                this.toggleAutoSave();
            }),
            vscode.commands.registerCommand('documentWriter.recoverDocument', () => {
                this.recoverDocument();
            })
        );
    }

    /**
     * Start auto-save monitoring
     */
    public start(): void {
        // Clear any existing timer
        this.stop();

        // Set up auto-save interval
        this.autoSaveTimer = setInterval(() => {
            if (this.isDirty && this.currentDocument) {
                this.save();
            }
        }, AutoSaveManager.AUTO_SAVE_INTERVAL);

        // Show status bar item
        this.statusBarItem.show();

        // Check for recoverable documents on start
        this.checkForRecoverableDocuments();

        console.log('[AutoSave] Started auto-save monitoring');
    }

    /**
     * Stop auto-save monitoring
     */
    public stop(): void {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = undefined;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = undefined;
        }

        this.statusBarItem.hide();
        console.log('[AutoSave] Stopped auto-save monitoring');
    }

    /**
     * Toggle auto-save on/off
     */
    private async toggleAutoSave(): Promise<void> {
        const isEnabled = this.autoSaveTimer !== undefined;
        
        if (isEnabled) {
            this.stop();
            vscode.window.showInformationMessage('Auto-save disabled');
        } else {
            this.start();
            vscode.window.showInformationMessage('Auto-save enabled');
        }
    }

    /**
     * Mark document as changed
     * @param document The document state to track
     */
    public markDirty(document: AutoSaveState): void {
        this.currentDocument = document;
        this.isDirty = true;

        // Update status bar
        this.statusBarItem.text = '$(save) Auto-save pending...';

        // Debounce saves
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            if (this.isDirty && this.currentDocument) {
                this.save();
            }
        }, AutoSaveManager.DEBOUNCE_DELAY);
    }

    /**
     * Save current document state
     */
    private async save(): Promise<void> {
        if (!this.currentDocument) {
            return;
        }

        try {
            // Save to workspace state
            await this.context.workspaceState.update(
                AutoSaveManager.AUTO_SAVE_KEY,
                {
                    ...this.currentDocument,
                    timestamp: new Date().toISOString()
                }
            );

            this.isDirty = false;
            
            // Update status bar
            const time = new Date().toLocaleTimeString();
            this.statusBarItem.text = `$(check) Saved at ${time}`;
            
            // Reset text after 3 seconds
            setTimeout(() => {
                this.statusBarItem.text = '$(save) Auto-save enabled';
            }, 3000);

            console.log('[AutoSave] Saved document state');
        } catch (error) {
            console.error('[AutoSave] Failed to save:', error);
            vscode.window.showErrorMessage('Auto-save failed');
        }
    }

    /**
     * Check for recoverable documents
     */
    private async checkForRecoverableDocuments(): Promise<void> {
        const savedState = this.context.workspaceState.get<any>(AutoSaveManager.AUTO_SAVE_KEY);
        
        if (!savedState || !savedState.timestamp) {
            return;
        }

        // Check age of saved data
        const savedDate = new Date(savedState.timestamp);
        const now = new Date();
        const hoursSinceSave = (now.getTime() - savedDate.getTime()) / (1000 * 60 * 60);

        if (hoursSinceSave > AutoSaveManager.MAX_AGE_HOURS) {
            // Clear old data
            await this.context.workspaceState.update(AutoSaveManager.AUTO_SAVE_KEY, undefined);
            return;
        }

        // Show recovery notification
        const timeAgo = this.getTimeAgo(savedDate);
        const title = savedState.metadata?.title || 'Untitled Document';
        
        const action = await vscode.window.showInformationMessage(
            `Found auto-saved document "${title}" from ${timeAgo}`,
            'Recover',
            'Discard'
        );

        if (action === 'Recover') {
            await this.recoverDocument();
        } else if (action === 'Discard') {
            await this.context.workspaceState.update(AutoSaveManager.AUTO_SAVE_KEY, undefined);
        }
    }

    /**
     * Recover document from auto-save
     */
    private async recoverDocument(): Promise<void> {
        const savedState = this.context.workspaceState.get<any>(AutoSaveManager.AUTO_SAVE_KEY);
        
        if (!savedState) {
            vscode.window.showWarningMessage('No auto-saved document found');
            return;
        }

        try {
            // Show progress
            if (this.statusBarManager) {
                this.statusBarManager.showProgress('Recovering document...');
            }

            // Create temporary file for recovered content
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const recoveryPath = workspaceFolder 
                ? vscode.Uri.joinPath(workspaceFolder.uri, '.recovery', `recovered_${Date.now()}.md`)
                : vscode.Uri.file(`recovered_${Date.now()}.md`);

            // Write recovered content
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(recoveryPath, encoder.encode(savedState.content));

            // Open recovered document
            const doc = await vscode.workspace.openTextDocument(recoveryPath);
            await vscode.window.showTextDocument(doc);

            // Clear auto-save after successful recovery
            await this.context.workspaceState.update(AutoSaveManager.AUTO_SAVE_KEY, undefined);

            if (this.statusBarManager) {
                this.statusBarManager.hideProgress();
            }

            vscode.window.showInformationMessage(
                'Document recovered successfully. Please save it to a permanent location.'
            );
        } catch (error) {
            if (this.statusBarManager) {
                this.statusBarManager.hideProgress();
            }
            console.error('[AutoSave] Failed to recover document:', error);
            vscode.window.showErrorMessage('Failed to recover document');
        }
    }

    /**
     * Get human-readable time ago string
     */
    private getTimeAgo(date: Date): string {
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) {
            return 'just now';
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (seconds < 86400) {
            const hours = Math.floor(seconds / 3600);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleString();
        }
    }

    /**
     * Clear all auto-saved data
     */
    public async clear(): Promise<void> {
        await this.context.workspaceState.update(AutoSaveManager.AUTO_SAVE_KEY, undefined);
        this.isDirty = false;
        this.currentDocument = undefined;
        console.log('[AutoSave] Cleared saved data');
    }

    /**
     * Notify that a document was saved
     * @param documentPath The path of the saved document
     */
    public documentSaved(documentPath: string): void {
        // Clear dirty state if this is the current document
        if (this.currentDocument && this.currentDocument.documentPath === documentPath) {
            this.isDirty = false;
            
            // Clear any pending timers
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = undefined;
            }
            
            // Update status bar
            this.statusBarItem.text = '$(save) Auto-save enabled';
            
            console.log('[AutoSave] Document saved, cleared dirty state');
        }
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.stop();
        this.statusBarItem.dispose();
    }
}