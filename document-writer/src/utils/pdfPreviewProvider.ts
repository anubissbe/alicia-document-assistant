import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { DocumentFormat } from '../core/formatProcessor';
import { SecurityManager } from './securityManager';
import { PathSafetyUtils } from './pathSafetyUtils';
import { tmpdir } from 'os';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * PDF Preview options
 */
export interface PDFPreviewOptions {
    /**
     * The maximum number of pages to preview
     */
    maxPages?: number;
    
    /**
     * Whether to include thumbnails
     */
    includeThumbnails?: boolean;
    
    /**
     * The zoom level for the preview
     */
    zoomLevel?: number;
    
    /**
     * Whether to include PDF metadata
     */
    includeMetadata?: boolean;
}

/**
 * PDF Preview result
 */
export interface PDFPreviewResult {
    /**
     * HTML content for the preview
     */
    html: string;
    
    /**
     * Whether the preview was successful
     */
    success: boolean;
    
    /**
     * Error message if preview failed
     */
    error?: string;
    
    /**
     * Temporary files created during the preview process
     */
    temporaryFiles?: string[];
}

/**
 * PDF Metadata
 */
export interface PDFMetadata {
    /**
     * The title of the PDF
     */
    title?: string;
    
    /**
     * The author of the PDF
     */
    author?: string;
    
    /**
     * The subject of the PDF
     */
    subject?: string;
    
    /**
     * The keywords of the PDF
     */
    keywords?: string[];
    
    /**
     * The creator of the PDF
     */
    creator?: string;
    
    /**
     * The producer of the PDF
     */
    producer?: string;
    
    /**
     * The creation date of the PDF
     */
    creationDate?: Date;
    
    /**
     * The modification date of the PDF
     */
    modificationDate?: Date;
    
    /**
     * The number of pages in the PDF
     */
    pageCount?: number;
}

/**
 * PDFPreviewProvider handles generating HTML previews of PDF documents
 */
export class PDFPreviewProvider {
    private _securityManager: SecurityManager;
    private _pathSafetyUtils: PathSafetyUtils;
    
    /**
     * Constructor
     */
    constructor() {
        this._securityManager = new SecurityManager();
        this._pathSafetyUtils = new PathSafetyUtils(this._securityManager);
    }
    
    /**
     * Generate a preview of a PDF document
     * @param content PDF content or path
     * @param options Preview options
     * @returns Preview result
     */
    public async generatePreview(
        content: string | Buffer,
        options: PDFPreviewOptions = {}
    ): Promise<PDFPreviewResult> {
        try {
            // Default options
            const maxPages = options.maxPages ?? 5;
            const includeThumbnails = options.includeThumbnails ?? true;
            const zoomLevel = options.zoomLevel ?? 1.0;
            const includeMetadata = options.includeMetadata ?? true;
            
            // Temporary files created during processing
            const temporaryFiles: string[] = [];
            
            // Determine if content is a file path, Buffer, or base64 string
            let pdfPath: string;
            let pdfBuffer: Buffer;
            
            if (typeof content === 'string') {
                if (content.toLowerCase().endsWith('.pdf') && fs.existsSync(content)) {
                    // It's a file path
                    pdfPath = content;
                    pdfBuffer = await readFile(pdfPath);
                } else if (content.match(/^[A-Za-z0-9+/=]+$/)) {
                    // It's base64 encoded content
                    pdfBuffer = Buffer.from(content, 'base64');
                    
                    // Save to temporary file for processing
                    const tempDir = tmpdir();
                    pdfPath = path.join(tempDir, `pdf-preview-${Date.now()}.pdf`);
                    await writeFile(pdfPath, pdfBuffer);
                    temporaryFiles.push(pdfPath);
                } else {
                    // It's raw binary content as a string
                    pdfBuffer = Buffer.from(content, 'binary');
                    
                    // Save to temporary file for processing
                    const tempDir = tmpdir();
                    pdfPath = path.join(tempDir, `pdf-preview-${Date.now()}.pdf`);
                    await writeFile(pdfPath, pdfBuffer);
                    temporaryFiles.push(pdfPath);
                }
            } else {
                // It's already a Buffer
                pdfBuffer = content;
                
                // Save to temporary file for processing
                const tempDir = tmpdir();
                pdfPath = path.join(tempDir, `pdf-preview-${Date.now()}.pdf`);
                await writeFile(pdfPath, pdfBuffer);
                temporaryFiles.push(pdfPath);
            }
            
            // Validate file path (security check)
            const validPath = this._pathSafetyUtils.resolveDocumentPath(pdfPath, 'PDF preview');
            if (!validPath) {
                throw new Error('Invalid PDF path');
            }
            
            // Generate metadata if needed
            let metadata: PDFMetadata | undefined;
            if (includeMetadata) {
                metadata = await this._extractPDFMetadata(pdfBuffer, pdfPath);
            }
            
            // Generate preview HTML
            const previewHtml = this._generatePDFPreviewHtml(
                pdfPath,
                pdfBuffer,
                metadata,
                maxPages,
                includeThumbnails,
                zoomLevel
            );
            
            return {
                html: previewHtml,
                success: true,
                temporaryFiles
            };
        } catch (error) {
            console.error('Error generating PDF preview:', error);
            return {
                html: this._generateErrorHtml(error),
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    
    /**
     * Extract metadata from a PDF document
     * @param pdfBuffer PDF buffer
     * @param pdfPath PDF file path
     * @returns PDF metadata
     */
    private async _extractPDFMetadata(pdfBuffer: Buffer, pdfPath: string): Promise<PDFMetadata> {
        // In a full implementation, we would use a PDF parsing library
        // For now, return some basic metadata based on file stats
        try {
            const stats = fs.statSync(pdfPath);
            
            return {
                title: path.basename(pdfPath, '.pdf'),
                pageCount: this._estimatePageCount(pdfBuffer, pdfPath),
                creationDate: stats.birthtime,
                modificationDate: stats.mtime
            };
        } catch (error) {
            console.error('Error extracting PDF metadata:', error);
            return {};
        }
    }
    
    /**
     * Estimate the number of pages in a PDF document
     * @param pdfBuffer PDF buffer
     * @param pdfPath PDF file path (for additional context)
     * @returns Estimated page count
     */
    private _estimatePageCount(pdfBuffer: Buffer, pdfPath: string): number {
        // In a full implementation, we would use a PDF parsing library
        // For now, make a rough estimate based on buffer size
        // This is not accurate but serves as a placeholder
        const pdfContent = pdfBuffer.toString('utf8', 0, Math.min(pdfBuffer.length, 10000));
        const pageLabels = pdfContent.match(/\/Page\s*\//g);
        
        if (pageLabels && pageLabels.length > 0) {
            return pageLabels.length;
        } else {
            // Rough estimate based on file size (not accurate)
            return Math.max(1, Math.floor(pdfBuffer.length / 30000));
        }
    }
    
    /**
     * Generate HTML for PDF preview
     * @param pdfPath PDF file path
     * @param pdfBuffer PDF buffer
     * @param metadata PDF metadata
     * @param maxPages Maximum number of pages to preview
     * @param includeThumbnails Whether to include thumbnails
     * @param zoomLevel Zoom level for the preview
     * @returns HTML content
     */
    private _generatePDFPreviewHtml(
        pdfPath: string,
        pdfBuffer: Buffer,
        metadata?: PDFMetadata,
        maxPages: number = 5,
        includeThumbnails: boolean = true,
        zoomLevel: number = 1.0
    ): string {
        // Convert the PDF to a base64 data URL
        const base64Data = pdfBuffer.toString('base64');
        const dataUrl = `data:application/pdf;base64,${base64Data}`;
        
        // Get file name without path and extension
        const fileName = path.basename(pdfPath, '.pdf');
        
        // Format metadata
        let metadataHtml = '';
        if (metadata) {
            metadataHtml = `
<div class="pdf-metadata">
    <h3>Document Information</h3>
    <table>
        ${metadata.title ? `<tr><td>Title:</td><td>${metadata.title}</td></tr>` : ''}
        ${metadata.author ? `<tr><td>Author:</td><td>${metadata.author}</td></tr>` : ''}
        ${metadata.subject ? `<tr><td>Subject:</td><td>${metadata.subject}</td></tr>` : ''}
        ${metadata.pageCount ? `<tr><td>Pages:</td><td>${metadata.pageCount}</td></tr>` : ''}
        ${metadata.creationDate ? `<tr><td>Created:</td><td>${metadata.creationDate.toLocaleString()}</td></tr>` : ''}
        ${metadata.modificationDate ? `<tr><td>Modified:</td><td>${metadata.modificationDate.toLocaleString()}</td></tr>` : ''}
    </table>
</div>`;
        }
        
        // Generate HTML with embedded PDF viewer
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF Preview: ${fileName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            margin: 0;
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        
        .pdf-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
        }
        
        .pdf-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            margin-bottom: 20px;
        }
        
        .pdf-title {
            font-size: 1.5em;
            margin: 0;
        }
        
        .pdf-controls {
            display: flex;
            gap: 10px;
        }
        
        .pdf-metadata {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            width: 100%;
            box-sizing: border-box;
        }
        
        .pdf-metadata h3 {
            margin-top: 0;
            margin-bottom: 10px;
        }
        
        .pdf-metadata table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .pdf-metadata td {
            padding: 5px;
            vertical-align: top;
        }
        
        .pdf-metadata td:first-child {
            font-weight: bold;
            width: 100px;
        }
        
        .pdf-viewer {
            width: 100%;
            height: 800px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
        }
        
        .pdf-thumbnails {
            display: ${includeThumbnails ? 'flex' : 'none'};
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 20px;
            width: 100%;
        }
        
        .pdf-thumbnail {
            width: 150px;
            height: 200px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            cursor: pointer;
            position: relative;
        }
        
        .pdf-thumbnail:hover {
            border-color: var(--vscode-focusBorder);
        }
        
        .pdf-page-number {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background-color: rgba(0, 0, 0, 0.5);
            color: white;
            text-align: center;
            padding: 3px 0;
        }
        
        .pdf-download {
            display: inline-block;
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            text-decoration: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .pdf-download:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .zoom-control {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    </style>
</head>
<body>
    <div class="pdf-container">
        <div class="pdf-header">
            <h1 class="pdf-title">${fileName}</h1>
            <div class="pdf-controls">
                <div class="zoom-control">
                    <button id="zoom-out" title="Zoom Out">-</button>
                    <span id="zoom-level">${zoomLevel * 100}%</span>
                    <button id="zoom-in" title="Zoom In">+</button>
                </div>
                <a class="pdf-download" href="${dataUrl}" download="${fileName}.pdf">Download</a>
            </div>
        </div>
        
        ${metadataHtml}
        
        <iframe class="pdf-viewer" src="${dataUrl}" type="application/pdf"></iframe>
        
        <div class="pdf-thumbnails" id="pdf-thumbnails">
            <!-- Thumbnails would be dynamically generated with a full implementation -->
            <!-- For now, this is a placeholder for the thumbnails area -->
            <div class="pdf-thumbnail">
                <div class="pdf-page-number">Page 1</div>
            </div>
        </div>
    </div>
    
    <script>
        (function() {
            // Get elements
            const zoomOutButton = document.getElementById('zoom-out');
            const zoomInButton = document.getElementById('zoom-in');
            const zoomLevelSpan = document.getElementById('zoom-level');
            const pdfViewer = document.querySelector('.pdf-viewer');
            
            // Initialize zoom level
            let currentZoom = ${zoomLevel};
            
            // Update zoom level
            function updateZoom() {
                zoomLevelSpan.textContent = \`\${Math.round(currentZoom * 100)}%\`;
                pdfViewer.style.transform = \`scale(\${currentZoom})\`;
                pdfViewer.style.transformOrigin = 'center top';
            }
            
            // Zoom out
            zoomOutButton.addEventListener('click', () => {
                if (currentZoom > 0.25) {
                    currentZoom -= 0.1;
                    updateZoom();
                }
            });
            
            // Zoom in
            zoomInButton.addEventListener('click', () => {
                if (currentZoom < 3.0) {
                    currentZoom += 0.1;
                    updateZoom();
                }
            });
            
            // Initialize zoom
            updateZoom();
            
            // Enable communication with VSCode
            const vscode = acquireVsCodeApi();
            
            // Send message when PDF is loaded
            pdfViewer.addEventListener('load', () => {
                vscode.postMessage({
                    command: 'pdfLoaded',
                    fileName: '${fileName}'
                });
            });
        })();
    </script>
</body>
</html>`;
    }
    
    /**
     * Generate HTML for error display
     * @param error Error that occurred
     * @returns HTML content
     */
    private _generateErrorHtml(error: unknown): string {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF Preview Error</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        
        .error-container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .error-title {
            color: var(--vscode-errorForeground);
            margin-bottom: 20px;
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
        
        .error-details h3 {
            margin-top: 0;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <h1 class="error-title">PDF Preview Error</h1>
        <div class="error-message">
            ${this._escapeHtml(errorMessage)}
        </div>
        <div class="error-details">
            <h3>Possible Solutions</h3>
            <ul>
                <li>Ensure the PDF file is valid and not corrupted.</li>
                <li>Check if the file is accessible and not locked by another process.</li>
                <li>For large PDFs, try viewing with an external PDF viewer.</li>
                <li>Ensure you have the necessary permissions to access the file.</li>
            </ul>
        </div>
    </div>
</body>
</html>`;
    }
    
    /**
     * Escape HTML special characters
     * @param text Text to escape
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
    
    /**
     * Clean up temporary files
     * @param files Array of file paths to clean up
     */
    public async cleanupTemporaryFiles(files: string[]): Promise<void> {
        for (const file of files) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            } catch (error) {
                console.warn(`Failed to clean up temporary file ${file}:`, error);
            }
        }
    }
}
