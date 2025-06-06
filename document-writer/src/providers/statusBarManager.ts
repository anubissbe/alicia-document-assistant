import * as vscode from 'vscode';
import * as path from 'path';
import { ClineIntegration } from '../integrations/clineIntegration';
import { DocumentService } from '../services/documentService';
import { PerformanceManager } from '../utils/performanceManager';

export interface DocumentStatistics {
    words: number;
    characters: number;
    charactersWithoutSpaces: number;
    lines: number;
    paragraphs: number;
    pages: number;
    readingTime: number;
    images: number;
    headings: {
        h1: number;
        h2: number;
        h3: number;
    };
    format?: string;
}

export class StatusBarManager {
    private aiStatusItem: vscode.StatusBarItem;
    private documentStatsItem: vscode.StatusBarItem;
    private progressItem: vscode.StatusBarItem;
    private quickActionsItem: vscode.StatusBarItem;
    private activeDocument: vscode.TextDocument | undefined;
    private isAiConnected: boolean = false;
    private currentProgress: number = 0;
    private progressTimer: NodeJS.Timeout | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private clineIntegration?: ClineIntegration,
        private documentService?: DocumentService
    ) {
        // Create status bar items
        this.aiStatusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.documentStatsItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        this.progressItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            98
        );
        this.quickActionsItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );

        // Register status bar items
        context.subscriptions.push(
            this.aiStatusItem,
            this.documentStatsItem,
            this.progressItem,
            this.quickActionsItem
        );

        // Initialize items
        this.initializeStatusBarItems();
        
        // Register event listeners
        this.registerEventListeners();

        // Initial update
        this.updateAllStatusItems();
    }

    private initializeStatusBarItems(): void {
        // AI Connection Status
        this.aiStatusItem.tooltip = 'AI Assistant Connection Status';
        this.aiStatusItem.command = 'documentWriter.showAiStatus';
        
        // Document Statistics
        this.documentStatsItem.tooltip = 'Document Statistics';
        this.documentStatsItem.command = 'documentWriter.showDetailedStats';
        
        // Progress Indicator
        this.progressItem.tooltip = 'Current Operation Progress';
        this.progressItem.hide();
        
        // Quick Actions
        this.quickActionsItem.text = '$(file-text) Quick Actions';
        this.quickActionsItem.tooltip = 'Document Writer Quick Actions';
        this.quickActionsItem.command = 'documentWriter.showQuickActions';
        this.quickActionsItem.show();
    }

    private registerEventListeners(): void {
        // Listen for active editor changes
        this.context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(() => {
                this.updateDocumentStats();
            })
        );

        // Listen for document changes
        this.context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (event.document === vscode.window.activeTextEditor?.document) {
                    this.updateDocumentStats();
                }
            })
        );

        // Register commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('documentWriter.showAiStatus', () => {
                this.showAiStatusDetails();
            }),
            vscode.commands.registerCommand('documentWriter.showDetailedStats', () => {
                this.showDetailedStatistics();
            }),
            vscode.commands.registerCommand('documentWriter.showQuickActions', () => {
                this.showQuickActionsPicker();
            })
        );

        // Check AI connection periodically
        setInterval(() => {
            this.updateAiConnectionStatus();
        }, 5000);
    }

    private updateAllStatusItems(): void {
        this.updateAiConnectionStatus();
        this.updateDocumentStats();
    }

    public updateAiConnectionStatus(): void {
        if (this.clineIntegration) {
            // Check if MCP server is running
            const isConnected = this.clineIntegration.isServerRunning();
            this.isAiConnected = isConnected;
            
            if (isConnected) {
                this.aiStatusItem.text = '$(check) AI Connected';
                this.aiStatusItem.backgroundColor = undefined;
                this.aiStatusItem.color = new vscode.ThemeColor('statusBarItem.foreground');
            } else {
                this.aiStatusItem.text = '$(warning) AI Disconnected';
                this.aiStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                this.aiStatusItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
            }
        } else {
            this.aiStatusItem.text = '$(circle-slash) AI Not Available';
            this.aiStatusItem.backgroundColor = undefined;
            this.aiStatusItem.color = new vscode.ThemeColor('statusBarItem.foreground');
        }
        
        this.aiStatusItem.show();
    }

    public updateDocumentStats(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.documentStatsItem.hide();
            return;
        }

        const document = editor.document;
        const text = document.getText();
        const stats = this.calculateStatistics(text);
        
        // Format display
        const format = this.getDocumentFormat(document);
        let statsText = `$(file-text) ${stats.words} words`;
        
        // Add reading time if document is substantial
        if (stats.words > 50) {
            statsText += ` | ${stats.readingTime} min read`;
        }
        
        // Add page count
        if (stats.pages > 0) {
            statsText += ` | ${stats.pages} ${stats.pages === 1 ? 'page' : 'pages'}`;
        }
        
        if (format) {
            statsText += ` | ${format}`;
        }
        
        this.documentStatsItem.text = statsText;
        this.documentStatsItem.show();
    }

    private calculateStatistics(text: string): DocumentStatistics {
        const words = text.split(/\s+/).filter(word => word.length > 0).length;
        const characters = text.length;
        const charactersWithoutSpaces = text.replace(/\s/g, '').length;
        const lines = text.split('\n').length;
        
        // Paragraph count (double newline separated)
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0).length;
        
        // Page count (assuming 300 words per page)
        const pages = Math.ceil(words / 300);
        
        // Reading time (assuming 200 words per minute)
        const readingTime = Math.ceil(words / 200);
        
        // Image count (Markdown images)
        const images = (text.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;
        
        // Heading counts
        const headings = {
            h1: (text.match(/^# .+$/gm) || []).length,
            h2: (text.match(/^## .+$/gm) || []).length,
            h3: (text.match(/^### .+$/gm) || []).length
        };
        
        return {
            words,
            characters,
            charactersWithoutSpaces,
            lines,
            paragraphs,
            pages,
            readingTime,
            images,
            headings
        };
    }

    private getDocumentFormat(document: vscode.TextDocument): string | undefined {
        const fileName = document.fileName.toLowerCase();
        
        if (fileName.endsWith('.md')) return 'Markdown';
        if (fileName.endsWith('.docx')) return 'Word';
        if (fileName.endsWith('.html')) return 'HTML';
        if (fileName.endsWith('.pdf')) return 'PDF';
        if (fileName.endsWith('.txt')) return 'Text';
        
        return undefined;
    }

    public showProgress(message: string, increment: boolean = true): void {
        this.progressItem.text = `$(sync~spin) ${message}`;
        this.progressItem.show();
        
        if (increment && !this.progressTimer) {
            this.currentProgress = 0;
            this.progressTimer = setInterval(() => {
                this.currentProgress += 10;
                if (this.currentProgress >= 100) {
                    this.currentProgress = 0;
                }
                this.progressItem.text = `$(sync~spin) ${message} (${this.currentProgress}%)`;
            }, 200);
        }
    }

    public hideProgress(): void {
        this.progressItem.hide();
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = undefined;
        }
        this.currentProgress = 0;
    }

    public updateProgress(progress: number, message?: string): void {
        this.currentProgress = Math.min(100, Math.max(0, progress));
        const progressMessage = message || 'Processing';
        this.progressItem.text = `$(sync~spin) ${progressMessage} (${this.currentProgress}%)`;
        this.progressItem.show();
        
        if (this.currentProgress >= 100) {
            setTimeout(() => {
                this.hideProgress();
            }, 1000);
        }
    }

    private async showAiStatusDetails(): Promise<void> {
        if (!this.clineIntegration) {
            vscode.window.showInformationMessage('AI integration is not configured.');
            return;
        }

        const details = [];
        details.push(`Status: ${this.isAiConnected ? 'Connected' : 'Disconnected'}`);
        
        if (this.clineIntegration.isServerRunning()) {
            details.push(`MCP Server Port: ${this.clineIntegration.getServerPort()}`);
            details.push(`Process ID: ${this.clineIntegration.getProcessId()}`);
        }

        const performanceData = PerformanceManager.getInstance().getReport();
        if (performanceData.totalOperations > 0) {
            details.push(`Total Operations: ${performanceData.totalOperations}`);
            details.push(`Average Response Time: ${performanceData.averageDuration.toFixed(2)}ms`);
        }

        await vscode.window.showInformationMessage(
            'AI Connection Details',
            { modal: true, detail: details.join('\n') },
            'Reconnect',
            'Close'
        ).then(selection => {
            if (selection === 'Reconnect' && this.clineIntegration) {
                vscode.commands.executeCommand('documentWriter.startMcpServer');
            }
        });
    }

    private async showDetailedStatistics(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active document.');
            return;
        }

        const text = editor.document.getText();
        const stats = this.calculateStatistics(text);
        const fileName = path.basename(editor.document.fileName);
        
        // Create a webview panel for better presentation
        const panel = vscode.window.createWebviewPanel(
            'documentStatistics',
            'Document Statistics',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Generate HTML content
        panel.webview.html = this.getStatisticsHtml(stats, fileName);
        
        // Alternative: Show in quick pick with all stats
        const items: vscode.QuickPickItem[] = [
            { label: '📝 Word Statistics', kind: vscode.QuickPickItemKind.Separator },
            { label: `Words: ${stats.words.toLocaleString()}`, description: 'Total word count' },
            { label: `Pages: ${stats.pages}`, description: 'Estimated pages (300 words/page)' },
            { label: `Reading Time: ${stats.readingTime} minutes`, description: 'At 200 words/minute' },
            
            { label: '📄 Document Structure', kind: vscode.QuickPickItemKind.Separator },
            { label: `Paragraphs: ${stats.paragraphs}`, description: 'Double-newline separated' },
            { label: `Lines: ${stats.lines.toLocaleString()}`, description: 'Total line count' },
            { label: `Average words per line: ${(stats.words / stats.lines).toFixed(1)}` },
            
            { label: '🔤 Character Statistics', kind: vscode.QuickPickItemKind.Separator },
            { label: `Characters: ${stats.characters.toLocaleString()}`, description: 'Including spaces' },
            { label: `Characters (no spaces): ${stats.charactersWithoutSpaces.toLocaleString()}` },
            
            { label: '📑 Content Analysis', kind: vscode.QuickPickItemKind.Separator },
            { label: `Images: ${stats.images}`, description: 'Markdown images' },
            { label: `H1 Headings: ${stats.headings.h1}` },
            { label: `H2 Headings: ${stats.headings.h2}` },
            { label: `H3 Headings: ${stats.headings.h3}` }
        ];

        // If there's a selection, add selection stats
        const selection = editor.document.getText(editor.selection);
        if (selection && !editor.selection.isEmpty) {
            const selectionStats = this.calculateStatistics(selection);
            items.push(
                { label: '✂️ Selection Statistics', kind: vscode.QuickPickItemKind.Separator },
                { label: `Selected Words: ${selectionStats.words}` },
                { label: `Selected Characters: ${selectionStats.characters}` }
            );
        }

        // Show quick pick as alternative
        const action = await vscode.window.showQuickPick(
            [{ label: '📊 View in Panel', description: 'Already open in side panel' }],
            { placeHolder: 'Document statistics shown in side panel' }
        );
    }

    private getStatisticsHtml(stats: DocumentStatistics, fileName: string): string {
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
                h1, h2 {
                    color: var(--vscode-foreground);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 8px;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 20px;
                    margin: 20px 0;
                }
                .stat-card {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 16px;
                    border-radius: 4px;
                    text-align: center;
                    border: 1px solid var(--vscode-panel-border);
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                    margin-bottom: 4px;
                }
                .stat-label {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    text-transform: uppercase;
                }
                .detail-section {
                    margin: 20px 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                td {
                    padding: 8px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                td:first-child {
                    font-weight: bold;
                    width: 40%;
                }
            </style>
        </head>
        <body>
            <h1>📊 Document Statistics</h1>
            <p style="color: var(--vscode-descriptionForeground);">${fileName}</p>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.words.toLocaleString()}</div>
                    <div class="stat-label">Words</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.pages}</div>
                    <div class="stat-label">Pages</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.readingTime}</div>
                    <div class="stat-label">Min Read</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.paragraphs}</div>
                    <div class="stat-label">Paragraphs</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h2>Document Structure</h2>
                <table>
                    <tr><td>Total Lines</td><td>${stats.lines.toLocaleString()}</td></tr>
                    <tr><td>Characters (with spaces)</td><td>${stats.characters.toLocaleString()}</td></tr>
                    <tr><td>Characters (no spaces)</td><td>${stats.charactersWithoutSpaces.toLocaleString()}</td></tr>
                    <tr><td>Average Words per Line</td><td>${(stats.words / stats.lines).toFixed(1)}</td></tr>
                    <tr><td>Images</td><td>${stats.images}</td></tr>
                </table>
            </div>
            
            <div class="detail-section">
                <h2>Heading Analysis</h2>
                <table>
                    <tr><td>H1 Headings (#)</td><td>${stats.headings.h1}</td></tr>
                    <tr><td>H2 Headings (##)</td><td>${stats.headings.h2}</td></tr>
                    <tr><td>H3 Headings (###)</td><td>${stats.headings.h3}</td></tr>
                    <tr><td>Total Headings</td><td>${stats.headings.h1 + stats.headings.h2 + stats.headings.h3}</td></tr>
                </table>
            </div>
        </body>
        </html>
        `;
    }

    private async showQuickActionsPicker(): Promise<void> {
        const quickPicks: vscode.QuickPickItem[] = [
            {
                label: '$(file-add) Create New Document',
                description: 'Start document creation wizard',
                detail: 'Create a new document using AI assistance'
            },
            {
                label: '$(export) Export Document',
                description: 'Export to different formats',
                detail: 'Export the current document to PDF, Word, or HTML'
            },
            {
                label: '$(checklist) Analyze Document',
                description: 'Get AI-powered analysis',
                detail: 'Analyze structure, content, and get improvement suggestions'
            },
            {
                label: '$(graph) Generate Chart',
                description: 'Create data visualization',
                detail: 'Generate charts from document data'
            },
            {
                label: '$(files) Manage Templates',
                description: 'Open template manager',
                detail: 'View and manage document templates'
            },
            {
                label: '$(comment-discussion) Document Assistant',
                description: 'Open AI chat assistant',
                detail: 'Get help with your document'
            },
            {
                label: '$(preview) Preview Document',
                description: 'Show document preview',
                detail: 'Preview the document in different formats'
            },
            {
                label: '$(gear) Settings',
                description: 'Configure Document Writer',
                detail: 'Open Document Writer settings'
            }
        ];

        const selection = await vscode.window.showQuickPick(quickPicks, {
            placeHolder: 'Select an action',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selection) {
            // Execute corresponding command based on selection
            switch (selection.label) {
                case '$(file-add) Create New Document':
                    vscode.commands.executeCommand('documentWriter.showWizard');
                    break;
                case '$(export) Export Document':
                    vscode.commands.executeCommand('documentWriter.exportDocument');
                    break;
                case '$(checklist) Analyze Document':
                    vscode.commands.executeCommand('documentWriter.analyzeDocument');
                    break;
                case '$(graph) Generate Chart':
                    vscode.commands.executeCommand('documentWriter.generateChart');
                    break;
                case '$(files) Manage Templates':
                    vscode.commands.executeCommand('documentWriter.openTemplateManager');
                    break;
                case '$(comment-discussion) Document Assistant':
                    vscode.commands.executeCommand('documentWriter.showAssistant');
                    break;
                case '$(preview) Preview Document':
                    vscode.commands.executeCommand('documentWriter.previewDocument');
                    break;
                case '$(gear) Settings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'documentWriter');
                    break;
            }
        }
    }

    public dispose(): void {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
        }
    }
}