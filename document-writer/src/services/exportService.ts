import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import { TemplateManagerService } from './templateManagerService';
import { DocumentService } from './documentService';
import { FormatConverter, HtmlExportOptions, MarkdownExportOptions, PdfExportOptions } from '../utils/formatConverter';

/**
 * Enum representing the different preview format types
 */
export enum PreviewFormatType {
    HTML = 'html',
    Markdown = 'markdown',
    PDF = 'pdf'
}

/**
 * Interface for preview options
 */
export interface PreviewOptions {
    format: PreviewFormatType;
    title?: string;
    showInNewPanel?: boolean;
    viewColumn?: vscode.ViewColumn;
}

/**
 * Service for exporting documents to different formats
 */
export class ExportService {
    private templateManager: TemplateManagerService;
    private documentService: DocumentService;
    private formatConverter: FormatConverter;

    constructor(
        templateManager: TemplateManagerService,
        documentService: DocumentService
    ) {
        this.templateManager = templateManager;
        this.documentService = documentService;
        this.formatConverter = new FormatConverter();
    }

    /**
     * Export a document to PDF format
     * @param document The document to export
     * @param outputPath The path to save the PDF file
     * @returns Promise resolving to the path of the generated PDF
     */
    public async exportToPdf(document: any, outputPath: string): Promise<string> {
        try {
            // Generate HTML representation of the document
            const htmlContent = this.formatConverter.documentToHtml(document);
            
            // Create a temporary HTML file
            const tempDir = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', '.document-writer');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const tempHtmlPath = path.join(tempDir, `${document.title || 'document'}-${Date.now()}.html`);
            fs.writeFileSync(tempHtmlPath, htmlContent);
            
            // Generate PDF using Puppeteer
            const pdfOptions: PdfExportOptions = {
                pageSize: 'A4',
                margins: {
                    top: 25.4,    // 1cm in mm
                    right: 25.4,
                    bottom: 25.4,
                    left: 25.4
                },
                preserveStyles: true
            };
            
            const pdf = await this.generatePdfFromHtml(tempHtmlPath, outputPath);
            
            // Clean up the temporary HTML file
            fs.unlinkSync(tempHtmlPath);
            
            return pdf;
        } catch (error: any) {
            console.error('Error exporting to PDF:', error);
            throw new Error(`Failed to export document to PDF: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Export a document to HTML format
     * @param document The document to export
     * @param outputPath The path to save the HTML file
     * @returns Promise resolving to the path of the generated HTML
     */
    public async exportToHtml(document: any, outputPath: string): Promise<string> {
        try {
            // Generate HTML representation of the document
            const htmlContent = await this.generateHtml(document);
            
            // Write the HTML file
            fs.writeFileSync(outputPath, htmlContent);
            
            return outputPath;
        } catch (error: any) {
            console.error('Error exporting to HTML:', error);
            throw new Error(`Failed to export document to HTML: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Export a document to Markdown format
     * @param document The document to export
     * @param outputPath The path to save the Markdown file
     * @returns Promise resolving to the path of the generated Markdown
     */
    public async exportToMarkdown(document: any, outputPath: string): Promise<string> {
        try {
            // Generate Markdown representation of the document
            const markdownContent = this.generateMarkdown(document);
            
            // Write the Markdown file
            fs.writeFileSync(outputPath, markdownContent);
            
            return outputPath;
        } catch (error: any) {
            console.error('Error exporting to Markdown:', error);
            throw new Error(`Failed to export document to Markdown: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Generate HTML content from a document
     * @param document The document to convert to HTML
     * @returns The HTML content
     */
    private async generateHtml(document: any): Promise<string> {
        // Generate a simple HTML representation of the document
        const title = document.title || 'Untitled Document';
        const author = document.author || 'Unknown Author';
        
        let htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                h1, h2, h3, h4, h5, h6 {
                    color: #444;
                    margin-top: 1.5em;
                    margin-bottom: 0.5em;
                }
                h1 {
                    font-size: 2em;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 0.3em;
                }
                h2 {
                    font-size: 1.5em;
                }
                .author {
                    color: #666;
                    font-style: italic;
                    margin-bottom: 2em;
                }
                .section {
                    margin-bottom: 2em;
                }
                .section-title {
                    font-size: 1.2em;
                    font-weight: bold;
                    margin-bottom: 0.5em;
                }
                .section-content {
                    white-space: pre-wrap;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 1em 0;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f2f2f2;
                }
                .chart-container {
                    margin: 1em 0;
                    max-width: 100%;
                }
                .chart-title {
                    font-weight: bold;
                    margin-bottom: 0.5em;
                }
                img {
                    max-width: 100%;
                    height: auto;
                }
                .page-break {
                    page-break-after: always;
                }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <div class="author">By ${author}</div>
        `;
        
        // Add sections
        if (document.sections && document.sections.length > 0) {
            document.sections.forEach((section: any) => {
                htmlContent += `
                <div class="section">
                    <h2 class="section-title">${section.title || 'Untitled Section'}</h2>
                    <div class="section-content">${section.content || ''}</div>
                </div>
                `;
            });
        }
        
        // Add charts
        if (document.charts && document.charts.length > 0) {
            document.charts.forEach((chart: any) => {
                // If chart has a previewUrl or imageUrl, include it
                if (chart.previewUrl || chart.imageUrl) {
                    htmlContent += `
                    <div class="chart-container">
                        <h3 class="chart-title">${chart.title || 'Chart'}</h3>
                        <img src="${chart.previewUrl || chart.imageUrl}" alt="${chart.title || 'Chart'}">
                    </div>
                    `;
                }
            });
        }
        
        // Add tables
        if (document.tables && document.tables.length > 0) {
            document.tables.forEach((table: any) => {
                htmlContent += `
                <div class="table-container">
                    <h3 class="table-title">${table.title || 'Table'}</h3>
                    <table>
                        <thead>
                            <tr>
                `;
                
                // Table headers
                if (table.headers && table.headers.length > 0) {
                    table.headers.forEach((header: string) => {
                        htmlContent += `<th>${header}</th>`;
                    });
                }
                
                htmlContent += `
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                // Table data
                if (table.data && table.data.length > 0) {
                    table.data.forEach((row: any[]) => {
                        htmlContent += '<tr>';
                        row.forEach((cell) => {
                            htmlContent += `<td>${cell}</td>`;
                        });
                        htmlContent += '</tr>';
                    });
                }
                
                htmlContent += `
                        </tbody>
                    </table>
                </div>
                `;
            });
        }
        
        // Close HTML
        htmlContent += `
        </body>
        </html>
        `;
        
        return htmlContent;
    }

    /**
     * Generate a PDF from an HTML file using Puppeteer
     * @param htmlPath The path to the HTML file
     * @param outputPath The path to save the PDF file
     * @returns Promise resolving to the path of the generated PDF
     */
    private async generatePdfFromHtml(htmlPath: string, outputPath: string): Promise<string> {
        let browser;
        try {
            // Launch browser
            browser = await puppeteer.launch({
                headless: true // Use boolean instead of 'new' string for compatibility
            });
            
            // Open a new page
            const page = await browser.newPage();
            
            // Navigate to the HTML file
            await page.goto(`file://${htmlPath}`, {
                waitUntil: 'networkidle0'
            });
            
            // Generate PDF
            await page.pdf({
                path: outputPath,
                format: 'A4',
                margin: {
                    top: '1cm',
                    right: '1cm',
                    bottom: '1cm',
                    left: '1cm'
                },
                printBackground: true
            });
            
            return outputPath;
        } catch (error) {
            console.error('Error generating PDF:', error);
            throw error;
        } finally {
            // Close the browser
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Generate Markdown content from a document
     * @param document The document to convert to Markdown
     * @returns The Markdown content
     */
    private generateMarkdown(document: any): string {
        // Generate a simple Markdown representation of the document
        const title = document.title || 'Untitled Document';
        const author = document.author || 'Unknown Author';
        
        let markdownContent = `# ${title}\n\n`;
        markdownContent += `By ${author}\n\n`;
        
        // Add sections
        if (document.sections && document.sections.length > 0) {
            document.sections.forEach((section: any) => {
                markdownContent += `## ${section.title || 'Untitled Section'}\n\n`;
                markdownContent += `${section.content || ''}\n\n`;
            });
        }
        
        // Add charts (as references since we can't include actual charts in Markdown)
        if (document.charts && document.charts.length > 0) {
            markdownContent += `## Charts\n\n`;
            document.charts.forEach((chart: any, index: number) => {
                markdownContent += `### ${chart.title || `Chart ${index + 1}`}\n\n`;
                markdownContent += `[Chart image not displayed in Markdown]\n\n`;
            });
        }
        
        // Add tables
        if (document.tables && document.tables.length > 0) {
            document.tables.forEach((table: any) => {
                markdownContent += `### ${table.title || 'Table'}\n\n`;
                
                // Table headers
                if (table.headers && table.headers.length > 0) {
                    markdownContent += '| ' + table.headers.join(' | ') + ' |\n';
                    markdownContent += '|' + table.headers.map(() => '---').join('|') + '|\n';
                    
                    // Table data
                    if (table.data && table.data.length > 0) {
                        table.data.forEach((row: any[]) => {
                            markdownContent += '| ' + row.join(' | ') + ' |\n';
                        });
                    }
                    
                    markdownContent += '\n';
                }
            });
        }
        
        return markdownContent;
    }

    /**
     * Preview a document in the specified format
     * @param document The document to preview
     * @param options Preview options
     * @returns Promise resolving to the webview panel
     */
    public async previewDocument(document: any, options: PreviewOptions): Promise<vscode.WebviewPanel> {
        const title = options.title || document.title || 'Document Preview';
        const viewColumn = options.viewColumn || vscode.ViewColumn.Beside;
        
        switch (options.format) {
            case PreviewFormatType.HTML:
                return await this.previewAsHtml(document, title, viewColumn, options.showInNewPanel);
            case PreviewFormatType.Markdown:
                return await this.previewAsMarkdown(document, title, viewColumn, options.showInNewPanel);
            case PreviewFormatType.PDF:
                return await this.previewAsPdf(document, title, viewColumn, options.showInNewPanel);
            default:
                throw new Error(`Unsupported preview format: ${options.format}`);
        }
    }

    /**
     * Preview a document as HTML
     * @param document The document to preview
     * @param title Title for the preview panel
     * @param viewColumn VS Code view column to show the preview in
     * @param showInNewPanel Whether to show in a new panel or reuse existing
     * @returns Promise resolving to the webview panel
     */
    private async previewAsHtml(
        document: any, 
        title: string, 
        viewColumn: vscode.ViewColumn,
        _showInNewPanel?: boolean
    ): Promise<vscode.WebviewPanel> {
        // Generate HTML content
        const htmlContent = await this.generateHtml(document);
        
        // Create and show webview panel
        const panel = vscode.window.createWebviewPanel(
            'documentWriterHtmlPreview',
            `${title} (HTML)`,
            viewColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', '.document-writer'))
                ]
            }
        );
        
        // Set webview content
        panel.webview.html = htmlContent;
        
        return panel;
    }

    /**
     * Preview a document as Markdown
     * @param document The document to preview
     * @param title Title for the preview panel
     * @param viewColumn VS Code view column to show the preview in
     * @param showInNewPanel Whether to show in a new panel or reuse existing
     * @returns Promise resolving to the webview panel
     */
    private async previewAsMarkdown(
        document: any, 
        title: string, 
        viewColumn: vscode.ViewColumn,
        _showInNewPanel?: boolean
    ): Promise<vscode.WebviewPanel> {
        // Generate Markdown content
        const markdownContent = this.generateMarkdown(document);
        
        // Convert Markdown to HTML for preview
        const htmlContent = this.formatConverter.markdownToHtml(markdownContent);
        
        // Create webview panel
        const panel = vscode.window.createWebviewPanel(
            'documentWriterMarkdownPreview',
            `${title} (Markdown)`,
            viewColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        // Create HTML preview wrapper
        const previewHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title} - Markdown Preview</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, 'Ubuntu', 'Droid Sans', sans-serif;
                    line-height: 1.6;
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 0 20px;
                }
                pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 16px;
                    border-radius: 3px;
                    overflow: auto;
                }
                code {
                    font-family: var(--vscode-editor-font-family, 'Consolas, "Courier New", monospace');
                    font-size: var(--vscode-editor-font-size, 14px);
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 0.2em 0.4em;
                    border-radius: 3px;
                }
                blockquote {
                    border-left: 4px solid var(--vscode-activityBar-background);
                    padding-left: 16px;
                    margin-left: 0;
                    color: var(--vscode-descriptionForeground);
                }
                img {
                    max-width: 100%;
                    height: auto;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 1em 0;
                }
                th, td {
                    border: 1px solid var(--vscode-panel-border);
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: var(--vscode-editorGroupHeader-tabsBackground);
                }
                h1, h2, h3, h4, h5, h6 {
                    color: var(--vscode-editor-foreground);
                    margin-top: 24px;
                    margin-bottom: 16px;
                    font-weight: 600;
                    line-height: 1.25;
                }
                h1 {
                    font-size: 2em;
                    padding-bottom: 0.3em;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                h2 {
                    font-size: 1.5em;
                    padding-bottom: 0.3em;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                a {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                }
                a:hover {
                    text-decoration: underline;
                }
                hr {
                    border: 0;
                    height: 1px;
                    background-color: var(--vscode-panel-border);
                    margin: 24px 0;
                }
                .source-link {
                    text-align: right;
                    margin-top: 20px;
                    font-style: italic;
                }
            </style>
        </head>
        <body>
            <div class="markdown-body">
                ${htmlContent}
            </div>
            <div class="source-link">
                <a href="#" id="showSource">View Source</a>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                document.getElementById('showSource').addEventListener('click', (e) => {
                    e.preventDefault();
                    vscode.postMessage({
                        command: 'showSource',
                        text: ${JSON.stringify(markdownContent)}
                    });
                });
            </script>
        </body>
        </html>
        `;
        
        // Set webview content
        panel.webview.html = previewHtml;
        
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'showSource') {
                // Create a temporary markdown file and open it
                const tempDir = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', '.document-writer');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                
                const tempMdPath = path.join(tempDir, `${document.title || 'document'}-${Date.now()}.md`);
                fs.writeFileSync(tempMdPath, message.text);
                
                vscode.workspace.openTextDocument(tempMdPath).then(doc => {
                    vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                });
            }
        });
        
        return panel;
    }

    /**
     * Preview a document as PDF
     * @param document The document to preview
     * @param title Title for the preview panel
     * @param viewColumn VS Code view column to show the preview in
     * @param showInNewPanel Whether to show in a new panel or reuse existing
     * @returns Promise resolving to the webview panel
     */
    private async previewAsPdf(
        document: any, 
        title: string, 
        viewColumn: vscode.ViewColumn,
        _showInNewPanel?: boolean
    ): Promise<vscode.WebviewPanel> {
        // Create temporary directory if it doesn't exist
        const tempDir = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', '.document-writer');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Generate temporary PDF file
        const tempPdfPath = path.join(tempDir, `${document.title || 'document'}-${Date.now()}.pdf`);
        await this.exportToPdf(document, tempPdfPath);
        
        // Create webview panel
        const panel = vscode.window.createWebviewPanel(
            'documentWriterPdfPreview',
            `${title} (PDF)`,
            viewColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(tempDir)]
            }
        );
        
        // Create a link to the PDF file
        const pdfPath = vscode.Uri.file(tempPdfPath);
        const pdfUri = panel.webview.asWebviewUri(pdfPath);
        
        // Create HTML with PDF viewer
        const previewHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title} - PDF Preview</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, 'Ubuntu', 'Droid Sans', sans-serif;
                    line-height: 1.6;
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    margin: 0;
                }
                .header {
                    margin-bottom: 20px;
                }
                .pdf-container {
                    flex: 1;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                iframe {
                    flex: 1;
                    width: 100%;
                    border: 1px solid var(--vscode-panel-border);
                    background-color: white;
                }
                .external-link {
                    margin-top: 10px;
                }
                a {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                }
                a:hover {
                    text-decoration: underline;
                }
                h1 {
                    font-size: 1.5em;
                    margin: 0 0 10px 0;
                }
                .fallback {
                    display: none;
                    padding: 20px;
                    text-align: center;
                    background-color: var(--vscode-editorGroupHeader-tabsBackground);
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${title} - PDF Preview</h1>
                <div class="external-link">
                    <a href="${pdfUri}" target="_blank">Open PDF in external viewer</a>
                </div>
            </div>
            
            <div class="pdf-container">
                <iframe src="${pdfUri}" id="pdfViewer"></iframe>
                <div class="fallback" id="fallback">
                    <p>The built-in PDF viewer might not be supported in this environment.</p>
                    <p>Please use the link above to open the PDF in an external viewer.</p>
                </div>
            </div>
            
            <script>
                // Check if PDF is loaded in iframe
                const iframe = document.getElementById('pdfViewer');
                const fallback = document.getElementById('fallback');
                
                iframe.onerror = function() {
                    iframe.style.display = 'none';
                    fallback.style.display = 'block';
                };
                
                // In case iframe loads but PDF doesn't render
                setTimeout(() => {
                    try {
                        if (iframe.contentDocument && 
                            iframe.contentDocument.body && 
                            iframe.contentDocument.body.textContent && 
                            iframe.contentDocument.body.textContent.includes('PDF')) {
                            // PDF loaded successfully
                        } else {
                            iframe.style.display = 'none';
                            fallback.style.display = 'block';
                        }
                    } catch(e) {
                        // Access to iframe might be restricted due to CORS
                        // This is normal and not an error
                    }
                }, 2000);
            </script>
        </body>
        </html>
        `;
        
        // Set webview content
        panel.webview.html = previewHtml;
        
        // Clean up temp file when panel is closed
        panel.onDidDispose(() => {
            try {
                if (fs.existsSync(tempPdfPath)) {
                    fs.unlinkSync(tempPdfPath);
                }
            } catch (error) {
                console.error('Error cleaning up temporary PDF file:', error);
            }
        });
        
        return panel;
    }
}
