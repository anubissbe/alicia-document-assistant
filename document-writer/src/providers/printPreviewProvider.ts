import * as vscode from 'vscode';
import * as path from 'path';
import { marked } from 'marked';
import { DocumentService } from '../services/documentService';
import { StatusBarManager } from './statusBarManager';

export interface PrintSettings {
    fontSize: string;
    lineHeight: string;
    fontFamily: string;
    margins: string;
    pageSize: 'letter' | 'a4' | 'legal';
    orientation: 'portrait' | 'landscape';
    headerFooter: boolean;
    pageNumbers: boolean;
    colorMode: 'color' | 'grayscale';
    tableOfContents: boolean;
    pageBreaks: boolean;
}

export class PrintPreviewProvider {
    private printSettings: PrintSettings;
    private previewPanel: vscode.WebviewPanel | undefined;
    private readonly defaultSettings: PrintSettings = {
        fontSize: '12pt',
        lineHeight: '1.6',
        fontFamily: 'Georgia, serif',
        margins: '1in',
        pageSize: 'letter',
        orientation: 'portrait',
        headerFooter: true,
        pageNumbers: true,
        colorMode: 'color',
        tableOfContents: false,
        pageBreaks: true
    };

    constructor(
        private context: vscode.ExtensionContext,
        private documentService: DocumentService,
        private statusBarManager?: StatusBarManager
    ) {
        // Load saved settings
        this.printSettings = this.loadSettings();
        this.registerCommands();
    }

    private registerCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('documentWriter.printPreview', () => {
                this.showPrintPreview();
            }),
            vscode.commands.registerCommand('documentWriter.printSettings', () => {
                this.showPrintSettings();
            }),
            vscode.commands.registerCommand('documentWriter.quickPrint', () => {
                this.quickPrint();
            })
        );
    }

    /**
     * Show print preview
     */
    public async showPrintPreview(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active document to preview');
            return;
        }

        // Show progress
        if (this.statusBarManager) {
            this.statusBarManager.showProgress('Generating print preview...');
        }

        try {
            // Create or reveal preview panel
            if (this.previewPanel) {
                this.previewPanel.reveal(vscode.ViewColumn.Beside);
            } else {
                this.previewPanel = vscode.window.createWebviewPanel(
                    'printPreview',
                    'Print Preview',
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                        localResourceRoots: [
                            vscode.Uri.joinPath(this.context.extensionUri, 'media')
                        ]
                    }
                );

                // Handle panel disposal
                this.previewPanel.onDidDispose(
                    () => {
                        this.previewPanel = undefined;
                    },
                    null,
                    this.context.subscriptions
                );
            }

            // Set webview content
            this.previewPanel.webview.html = await this.getPreviewHtml(editor.document);

            // Handle messages from webview
            this.previewPanel.webview.onDidReceiveMessage(
                message => this.handleWebviewMessage(message),
                undefined,
                this.context.subscriptions
            );

            if (this.statusBarManager) {
                this.statusBarManager.hideProgress();
            }

        } catch (error) {
            if (this.statusBarManager) {
                this.statusBarManager.hideProgress();
            }
            console.error('Print preview error:', error);
            vscode.window.showErrorMessage(`Failed to generate print preview: ${error}`);
        }
    }

    /**
     * Generate preview HTML
     */
    private async getPreviewHtml(document: vscode.TextDocument): Promise<string> {
        const content = document.getText();
        const title = path.basename(document.fileName, path.extname(document.fileName));
        const isMarkdown = document.languageId === 'markdown';
        
        // Convert content to HTML if needed
        let htmlContent = content;
        if (isMarkdown) {
            htmlContent = await this.markdownToHtml(content);
        } else if (document.languageId === 'plaintext') {
            htmlContent = this.textToHtml(content);
        }

        // Add table of contents if enabled
        if (this.printSettings.tableOfContents && isMarkdown) {
            const toc = this.generateTableOfContents(content);
            if (toc) {
                htmlContent = toc + '<div class="page-break"></div>' + htmlContent;
            }
        }

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title} - Print Preview</title>
    <style>
        ${this.getPrintStyles()}
    </style>
</head>
<body>
    <div class="preview-controls">
        <div class="controls-left">
            <strong>Print Preview:</strong> ${title}
        </div>
        <div class="controls-right">
            <button onclick="handlePrint()">🖨️ Print</button>
            <button onclick="handleSettings()">⚙️ Settings</button>
            <button onclick="handleExportPDF()">📄 Export PDF</button>
        </div>
    </div>
    
    <div class="document-container">
        <div class="document-page">
            ${this.printSettings.headerFooter ? `
            <div class="page-header">
                <div class="header-left">${title}</div>
                <div class="header-right">${new Date().toLocaleDateString()}</div>
            </div>
            ` : ''}
            
            <div class="document-content">
                ${htmlContent}
            </div>
            
            ${this.printSettings.headerFooter && this.printSettings.pageNumbers ? `
            <div class="page-footer">
                <div class="footer-center">Page <span class="page-number">1</span></div>
            </div>
            ` : ''}
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function handlePrint() {
            window.print();
            vscode.postMessage({ command: 'print' });
        }
        
        function handleSettings() {
            vscode.postMessage({ command: 'settings' });
        }
        
        function handleExportPDF() {
            vscode.postMessage({ command: 'exportPDF' });
        }
        
        // Simulate page breaks and numbering
        window.addEventListener('load', () => {
            const content = document.querySelector('.document-content');
            const pageHeight = 11 * 96; // 11 inches at 96 DPI
            const elements = content.querySelectorAll('h1, h2, h3, p, ul, ol, table');
            let currentPage = 1;
            let currentHeight = 0;
            
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                currentHeight += rect.height;
                
                if (currentHeight > pageHeight * 0.8) {
                    // Add page break before element
                    if (${this.printSettings.pageBreaks} && (el.tagName === 'H1' || el.tagName === 'H2')) {
                        el.style.pageBreakBefore = 'always';
                        currentPage++;
                        currentHeight = rect.height;
                    }
                }
            });
            
            // Update page count display
            const pageNumberElement = document.querySelector('.page-number');
            if (pageNumberElement) {
                pageNumberElement.textContent = '1 of ' + currentPage;
            }
        });
    </script>
</body>
</html>
        `;
    }

    /**
     * Get print styles
     */
    private getPrintStyles(): string {
        return `
        /* Reset and base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: ${this.printSettings.fontFamily};
            font-size: ${this.printSettings.fontSize};
            line-height: ${this.printSettings.lineHeight};
            color: var(--vscode-editor-foreground, #333);
            background: var(--vscode-editor-background, #f5f5f5);
        }
        
        /* Preview controls */
        .preview-controls {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: var(--vscode-titleBar-activeBackground, #333);
            color: var(--vscode-titleBar-activeForeground, white);
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .preview-controls button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            margin-left: 8px;
        }
        
        .preview-controls button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .controls-right {
            display: flex;
            align-items: center;
        }
        
        /* Document container */
        .document-container {
            margin-top: 60px;
            padding: 20px;
            display: flex;
            justify-content: center;
            min-height: calc(100vh - 60px);
        }
        
        .document-page {
            width: ${this.printSettings.pageSize === 'letter' ? '8.5in' : this.printSettings.pageSize === 'a4' ? '210mm' : '8.5in'};
            min-height: ${this.printSettings.pageSize === 'letter' ? '11in' : this.printSettings.pageSize === 'a4' ? '297mm' : '14in'};
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            position: relative;
            padding: ${this.printSettings.margins};
        }
        
        /* Headers and footers */
        .page-header {
            position: absolute;
            top: 0.5in;
            left: ${this.printSettings.margins};
            right: ${this.printSettings.margins};
            display: flex;
            justify-content: space-between;
            font-size: 10pt;
            color: #666;
            padding-bottom: 0.25in;
            border-bottom: 1px solid #ddd;
        }
        
        .page-footer {
            position: absolute;
            bottom: 0.5in;
            left: ${this.printSettings.margins};
            right: ${this.printSettings.margins};
            text-align: center;
            font-size: 10pt;
            color: #666;
        }
        
        /* Document content */
        .document-content {
            padding-top: ${this.printSettings.headerFooter ? '1in' : '0'};
            padding-bottom: ${this.printSettings.headerFooter ? '1in' : '0'};
        }
        
        /* Typography */
        h1 {
            font-size: 24pt;
            margin-bottom: 16pt;
            color: ${this.printSettings.colorMode === 'grayscale' ? '#000' : '#222'};
            page-break-after: avoid;
        }
        
        h2 {
            font-size: 18pt;
            margin-top: 24pt;
            margin-bottom: 12pt;
            color: ${this.printSettings.colorMode === 'grayscale' ? '#000' : '#333'};
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 14pt;
            margin-top: 18pt;
            margin-bottom: 10pt;
            color: ${this.printSettings.colorMode === 'grayscale' ? '#000' : '#444'};
            page-break-after: avoid;
        }
        
        p {
            margin-bottom: 12pt;
            text-align: justify;
            orphans: 3;
            widows: 3;
        }
        
        /* Lists */
        ul, ol {
            margin-left: 24pt;
            margin-bottom: 12pt;
        }
        
        li {
            margin-bottom: 6pt;
        }
        
        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 16pt 0;
            page-break-inside: avoid;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 8pt;
            text-align: left;
        }
        
        th {
            background: ${this.printSettings.colorMode === 'grayscale' ? '#f0f0f0' : '#f5f5f5'};
            font-weight: bold;
        }
        
        /* Code blocks */
        pre {
            background: ${this.printSettings.colorMode === 'grayscale' ? '#f0f0f0' : '#f5f5f5'};
            padding: 12pt;
            margin: 12pt 0;
            overflow-x: auto;
            page-break-inside: avoid;
            font-family: 'Courier New', monospace;
            font-size: 10pt;
        }
        
        code {
            background: ${this.printSettings.colorMode === 'grayscale' ? '#f0f0f0' : '#f5f5f5'};
            padding: 2pt 4pt;
            font-family: 'Courier New', monospace;
        }
        
        /* Images */
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 16pt auto;
            page-break-inside: avoid;
            ${this.printSettings.colorMode === 'grayscale' ? 'filter: grayscale(100%);' : ''}
        }
        
        /* Links */
        a {
            color: ${this.printSettings.colorMode === 'grayscale' ? '#000' : 'var(--vscode-textLink-foreground, #007acc)'};
            text-decoration: ${this.printSettings.colorMode === 'grayscale' ? 'underline' : 'none'};
        }
        
        /* Page breaks */
        .page-break {
            page-break-after: always;
            height: 0;
            margin: 0;
        }
        
        /* Table of contents */
        .table-of-contents {
            margin-bottom: 24pt;
        }
        
        .table-of-contents h2 {
            margin-bottom: 12pt;
        }
        
        .toc-entry {
            margin-bottom: 6pt;
        }
        
        .toc-entry.level-1 {
            font-weight: bold;
        }
        
        .toc-entry.level-2 {
            margin-left: 24pt;
        }
        
        .toc-entry.level-3 {
            margin-left: 48pt;
        }
        
        /* Print specific styles */
        @media print {
            body {
                background: white;
            }
            
            .preview-controls {
                display: none !important;
            }
            
            .document-container {
                margin: 0;
                padding: 0;
            }
            
            .document-page {
                width: auto;
                height: auto;
                margin: 0;
                padding: ${this.printSettings.margins};
                box-shadow: none;
            }
            
            @page {
                size: ${this.printSettings.pageSize} ${this.printSettings.orientation};
                margin: ${this.printSettings.margins};
            }
            
            /* Show URLs for links in print */
            a[href^="http"]:after {
                content: " (" attr(href) ")";
                font-size: 10pt;
                color: #666;
            }
        }
        `;
    }

    /**
     * Convert markdown to HTML
     */
    private async markdownToHtml(markdown: string): Promise<string> {
        // Configure marked options
        marked.setOptions({
            gfm: true,
            breaks: true,
            tables: true,
            smartLists: true,
            smartypants: true
        });

        return marked.parse(markdown);
    }

    /**
     * Convert plain text to HTML
     */
    private textToHtml(text: string): string {
        return text
            .split('\n\n')
            .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
            .join('\n');
    }

    /**
     * Generate table of contents
     */
    private generateTableOfContents(markdown: string): string | null {
        const headings: Array<{level: number, text: string}> = [];
        const headingRegex = /^(#{1,3})\s+(.+)$/gm;
        
        let match;
        while ((match = headingRegex.exec(markdown)) !== null) {
            headings.push({
                level: match[1].length,
                text: match[2]
            });
        }

        if (headings.length === 0) {
            return null;
        }

        const tocEntries = headings.map(h => 
            `<div class="toc-entry level-${h.level}">${h.text}</div>`
        ).join('\n');

        return `
        <div class="table-of-contents">
            <h2>Table of Contents</h2>
            ${tocEntries}
        </div>
        `;
    }

    /**
     * Handle messages from webview
     */
    private async handleWebviewMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'print':
                // Log print action
                console.log('Document printed');
                break;
                
            case 'settings':
                await this.showPrintSettings();
                break;
                
            case 'exportPDF':
                await this.exportToPDF();
                break;
        }
    }

    /**
     * Show print settings
     */
    private async showPrintSettings(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'printSettings',
            'Print Settings',
            vscode.ViewColumn.Active,
            {
                enableScripts: true
            }
        );

        panel.webview.html = this.getSettingsHtml();

        // Handle settings update
        panel.webview.onDidReceiveMessage(
            async message => {
                if (message.command === 'updateSettings') {
                    this.printSettings = message.settings;
                    await this.saveSettings();
                    panel.dispose();
                    
                    // Refresh preview if open
                    if (this.previewPanel) {
                        const editor = vscode.window.activeTextEditor;
                        if (editor) {
                            this.previewPanel.webview.html = await this.getPreviewHtml(editor.document);
                        }
                    }
                    
                    vscode.window.showInformationMessage('Print settings updated');
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Get settings HTML
     */
    private getSettingsHtml(): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
        }
        h1 {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        select, input {
            width: 100%;
            padding: 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }
        .checkbox-group {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        .checkbox-group input {
            width: auto;
            margin-right: 8px;
        }
        button {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .actions {
            margin-top: 30px;
            text-align: right;
        }
    </style>
</head>
<body>
    <h1>🖨️ Print Settings</h1>
    
    <div class="form-group">
        <label>Font Size</label>
        <select id="fontSize">
            <option value="10pt" ${this.printSettings.fontSize === '10pt' ? 'selected' : ''}>10pt</option>
            <option value="11pt" ${this.printSettings.fontSize === '11pt' ? 'selected' : ''}>11pt</option>
            <option value="12pt" ${this.printSettings.fontSize === '12pt' ? 'selected' : ''}>12pt</option>
            <option value="14pt" ${this.printSettings.fontSize === '14pt' ? 'selected' : ''}>14pt</option>
        </select>
    </div>
    
    <div class="form-group">
        <label>Font Family</label>
        <select id="fontFamily">
            <option value="Georgia, serif" ${this.printSettings.fontFamily === 'Georgia, serif' ? 'selected' : ''}>Georgia (Serif)</option>
            <option value="Arial, sans-serif" ${this.printSettings.fontFamily === 'Arial, sans-serif' ? 'selected' : ''}>Arial (Sans-serif)</option>
            <option value="'Times New Roman', serif" ${this.printSettings.fontFamily === "'Times New Roman', serif" ? 'selected' : ''}>Times New Roman</option>
            <option value="'Helvetica Neue', sans-serif" ${this.printSettings.fontFamily === "'Helvetica Neue', sans-serif" ? 'selected' : ''}>Helvetica Neue</option>
        </select>
    </div>
    
    <div class="form-group">
        <label>Line Height</label>
        <select id="lineHeight">
            <option value="1.2" ${this.printSettings.lineHeight === '1.2' ? 'selected' : ''}>1.2 (Compact)</option>
            <option value="1.5" ${this.printSettings.lineHeight === '1.5' ? 'selected' : ''}>1.5 (Normal)</option>
            <option value="1.6" ${this.printSettings.lineHeight === '1.6' ? 'selected' : ''}>1.6 (Comfortable)</option>
            <option value="2.0" ${this.printSettings.lineHeight === '2.0' ? 'selected' : ''}>2.0 (Double)</option>
        </select>
    </div>
    
    <div class="form-group">
        <label>Page Size</label>
        <select id="pageSize">
            <option value="letter" ${this.printSettings.pageSize === 'letter' ? 'selected' : ''}>Letter (8.5" × 11")</option>
            <option value="a4" ${this.printSettings.pageSize === 'a4' ? 'selected' : ''}>A4 (210mm × 297mm)</option>
            <option value="legal" ${this.printSettings.pageSize === 'legal' ? 'selected' : ''}>Legal (8.5" × 14")</option>
        </select>
    </div>
    
    <div class="form-group">
        <label>Orientation</label>
        <select id="orientation">
            <option value="portrait" ${this.printSettings.orientation === 'portrait' ? 'selected' : ''}>Portrait</option>
            <option value="landscape" ${this.printSettings.orientation === 'landscape' ? 'selected' : ''}>Landscape</option>
        </select>
    </div>
    
    <div class="form-group">
        <label>Margins</label>
        <select id="margins">
            <option value="0.5in" ${this.printSettings.margins === '0.5in' ? 'selected' : ''}>Narrow (0.5")</option>
            <option value="1in" ${this.printSettings.margins === '1in' ? 'selected' : ''}>Normal (1")</option>
            <option value="1.25in" ${this.printSettings.margins === '1.25in' ? 'selected' : ''}>Wide (1.25")</option>
        </select>
    </div>
    
    <div class="form-group">
        <label>Color Mode</label>
        <select id="colorMode">
            <option value="color" ${this.printSettings.colorMode === 'color' ? 'selected' : ''}>Color</option>
            <option value="grayscale" ${this.printSettings.colorMode === 'grayscale' ? 'selected' : ''}>Grayscale</option>
        </select>
    </div>
    
    <div class="form-group">
        <div class="checkbox-group">
            <input type="checkbox" id="headerFooter" ${this.printSettings.headerFooter ? 'checked' : ''}>
            <label for="headerFooter">Show header and footer</label>
        </div>
        <div class="checkbox-group">
            <input type="checkbox" id="pageNumbers" ${this.printSettings.pageNumbers ? 'checked' : ''}>
            <label for="pageNumbers">Show page numbers</label>
        </div>
        <div class="checkbox-group">
            <input type="checkbox" id="tableOfContents" ${this.printSettings.tableOfContents ? 'checked' : ''}>
            <label for="tableOfContents">Generate table of contents (Markdown only)</label>
        </div>
        <div class="checkbox-group">
            <input type="checkbox" id="pageBreaks" ${this.printSettings.pageBreaks ? 'checked' : ''}>
            <label for="pageBreaks">Smart page breaks</label>
        </div>
    </div>
    
    <div class="actions">
        <button onclick="applySettings()">Apply Settings</button>
        <button onclick="window.close()">Cancel</button>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function applySettings() {
            const settings = {
                fontSize: document.getElementById('fontSize').value,
                fontFamily: document.getElementById('fontFamily').value,
                lineHeight: document.getElementById('lineHeight').value,
                pageSize: document.getElementById('pageSize').value,
                orientation: document.getElementById('orientation').value,
                margins: document.getElementById('margins').value,
                colorMode: document.getElementById('colorMode').value,
                headerFooter: document.getElementById('headerFooter').checked,
                pageNumbers: document.getElementById('pageNumbers').checked,
                tableOfContents: document.getElementById('tableOfContents').checked,
                pageBreaks: document.getElementById('pageBreaks').checked
            };
            
            vscode.postMessage({
                command: 'updateSettings',
                settings: settings
            });
        }
    </script>
</body>
</html>
        `;
    }

    /**
     * Quick print current document
     */
    private async quickPrint(): Promise<void> {
        // Show preview and trigger print
        await this.showPrintPreview();
        
        // Send print command to webview after a short delay
        setTimeout(() => {
            if (this.previewPanel) {
                this.previewPanel.webview.postMessage({ command: 'print' });
            }
        }, 500);
    }

    /**
     * Export to PDF
     */
    private async exportToPDF(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        // For now, inform user about using browser print to PDF
        const action = await vscode.window.showInformationMessage(
            'To export as PDF, use the print dialog and select "Save as PDF" as the printer.',
            'Open Print Dialog'
        );

        if (action === 'Open Print Dialog' && this.previewPanel) {
            this.previewPanel.webview.postMessage({ command: 'print' });
        }
    }

    /**
     * Load saved settings
     */
    private loadSettings(): PrintSettings {
        const saved = this.context.globalState.get<PrintSettings>('printSettings');
        return saved || { ...this.defaultSettings };
    }

    /**
     * Save settings
     */
    private async saveSettings(): Promise<void> {
        await this.context.globalState.update('printSettings', this.printSettings);
    }

    /**
     * Dispose
     */
    public dispose(): void {
        if (this.previewPanel) {
            this.previewPanel.dispose();
        }
    }
}