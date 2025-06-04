import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { DocumentFormat, FormatProcessor, FormatConversionOptions } from '../core/formatProcessor';
import { PathSafetyUtils } from './pathSafetyUtils';
import { SecurityManager } from './securityManager';
import { PDFPreviewProvider, PDFPreviewOptions } from './pdfPreviewProvider';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Preview options for document formats
 */
export interface PreviewOptions {
    /**
     * Whether to make the preview interactive
     */
    interactive?: boolean;
    
    /**
     * Whether to render mathematical expressions
     */
    renderMath?: boolean;
    
    /**
     * Whether to render diagrams (e.g., Mermaid)
     */
    renderDiagrams?: boolean;
    
    /**
     * Whether to highlight syntax in code blocks
     */
    highlightSyntax?: boolean;
    
    /**
     * Whether to show annotations
     */
    showAnnotations?: boolean;
}

/**
 * Document preview options
 */
export interface DocumentPreviewOptions extends FormatConversionOptions {
    /**
     * Target format for the preview
     */
    targetFormat?: DocumentFormat;
    
    /**
     * Preview-specific options
     */
    preview?: PreviewOptions;
    
    /**
     * Whether to open the file after export
     */
    openAfterExport?: boolean;
    
    /**
     * Output path for export operations
     */
    outputPath?: string;
}

/**
 * Export result
 */
export interface ExportResult {
    /**
     * Whether the export was successful
     */
    success: boolean;
    
    /**
     * Path to the exported file
     */
    filePath?: string;
    
    /**
     * Error message if export failed
     */
    error?: string;
}

/**
 * Format detection result
 */
export interface FormatDetectionResult {
    /**
     * Detected format
     */
    format: DocumentFormat;
    
    /**
     * Confidence level (0-1)
     */
    confidence: number;
}

/**
 * DocumentFormatConverter handles conversion between different document formats
 */
export class DocumentFormatConverter {
    private _formatProcessor: FormatProcessor;
    private _pathSafetyUtils: PathSafetyUtils;
    
    /**
     * Constructor
     */
    constructor() {
        this._formatProcessor = new FormatProcessor();
        const securityManager = new SecurityManager();
        this._pathSafetyUtils = new PathSafetyUtils(securityManager);
    }
    
    /**
     * Generate preview for document content
     * @param content Document content
     * @param sourceFormat Source format
     * @param options Preview options
     * @returns Preview content
     */
    public async generatePreview(
        content: string,
        sourceFormat: DocumentFormat,
        options: DocumentPreviewOptions = {}
    ): Promise<string> {
        try {
            // Default to HTML as target format for previews
            const targetFormat = options.targetFormat || DocumentFormat.HTML;
            
            // Convert content to target format
            let previewContent = await this._formatProcessor.processContent(
                content,
                sourceFormat,
                targetFormat,
                options
            );
            
            // Apply preview enhancements if needed
            if (targetFormat === DocumentFormat.HTML && options.preview) {
                previewContent = this._enhanceHtmlPreview(previewContent, options.preview);
            }
            
            return previewContent;
        } catch (error) {
            console.error('Error generating preview:', error);
            return this._createErrorPreview(error);
        }
    }
    
    /**
     * Export document to file
     * @param content Document content
     * @param sourceFormat Source format
     * @param targetFormat Target format
     * @param options Export options
     * @returns Export result
     */
    public async exportToFile(
        content: string,
        sourceFormat: DocumentFormat,
        targetFormat: DocumentFormat,
        options: DocumentPreviewOptions = {}
    ): Promise<ExportResult> {
        try {
            // Make sure we have an output path
            if (!options.outputPath) {
                throw new Error('Output path is required for export');
            }
            
            // Validate output path (security check)
            const validatedPath = this._pathSafetyUtils.resolveDocumentPath(options.outputPath, 'export operation');
            if (!validatedPath) {
                throw new Error('Invalid output path');
            }
            
            // Create directory if it doesn't exist
            const outputDir = path.dirname(validatedPath);
            await mkdir(outputDir, { recursive: true });
            
            // Determine if we need to process content or just write it directly
            if (sourceFormat === targetFormat) {
                // Write directly for same format
                await writeFile(validatedPath, content);
                
                // Open the file if requested
                if (options.openAfterExport) {
                    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(validatedPath));
                }
                
                return {
                    success: true,
                    filePath: validatedPath
                };
            } else {
                // Process content for format conversion
                const processedContent = await this._formatProcessor.processContent(
                    content,
                    sourceFormat,
                    targetFormat,
                    {
                        ...options,
                        outputPath: validatedPath
                    }
                );
                
                // For some formats (like DOCX, PDF), the result is the file path
                // For text-based formats, we need to write the content to the file
                if (processedContent.startsWith('/') || 
                    processedContent.match(/^[a-zA-Z]:\\/)) {
                    // Result is a file path, no need to write
                    const resultPath = processedContent;
                    
                    // Open the file if requested
                    if (options.openAfterExport && resultPath !== validatedPath) {
                        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(resultPath));
                    }
                    
                    return {
                        success: true,
                        filePath: resultPath
                    };
                } else {
                    // Result is content, write to file
                    await writeFile(validatedPath, processedContent);
                    
                    // Open the file if requested
                    if (options.openAfterExport) {
                        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(validatedPath));
                    }
                    
                    return {
                        success: true,
                        filePath: validatedPath
                    };
                }
            }
        } catch (error) {
            console.error('Error exporting document:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    
    /**
     * Detect format from content
     * @param content Content to analyze
     * @param filePath Optional file path for additional hints
     * @returns Format detection result
     */
    public detectFormat(content = '', filePath?: string): FormatDetectionResult {
        try {
            // Try to detect from file extension if available
            if (filePath) {
                const extension = path.extname(filePath).toLowerCase();
                
                if (extension === '.md' || extension === '.markdown') {
                    return { format: DocumentFormat.MARKDOWN, confidence: 0.9 };
                } else if (extension === '.html' || extension === '.htm') {
                    return { format: DocumentFormat.HTML, confidence: 0.9 };
                } else if (extension === '.txt') {
                    return { format: DocumentFormat.TEXT, confidence: 0.9 };
                } else if (extension === '.docx' || extension === '.doc') {
                    return { format: DocumentFormat.DOCX, confidence: 0.9 };
                } else if (extension === '.pdf') {
                    return { format: DocumentFormat.PDF, confidence: 0.9 };
                }
            }
            
            // Make sure we have content to analyze
            if (!content || content.trim() === '') {
                return { format: DocumentFormat.TEXT, confidence: 0.5 };
            }
            
            // Use content-based detection from the FormatProcessor
            // FormatProcessor.detectFormat requires a string parameter
            const format = this._formatProcessor.detectFormat(content || '');
            return {
                format: format,
                confidence: 0.7 // Lower confidence for content-based detection
            };
        } catch (error) {
            console.error('Error detecting format:', error);
            // Default to TEXT format if detection fails
            return { format: DocumentFormat.TEXT, confidence: 0.5 };
        }
    }
    
    /**
     * Get available target formats for a source format
     * @param sourceFormat Source format
     * @returns Array of available target formats
     */
    public getAvailableTargetFormats(sourceFormat: DocumentFormat): DocumentFormat[] {
        // Define available conversions for each format
        const availableConversions: Record<DocumentFormat, DocumentFormat[]> = {
            [DocumentFormat.TEXT]: [
                DocumentFormat.MARKDOWN,
                DocumentFormat.HTML,
                DocumentFormat.DOCX,
                DocumentFormat.PDF
            ],
            [DocumentFormat.MARKDOWN]: [
                DocumentFormat.TEXT,
                DocumentFormat.HTML,
                DocumentFormat.DOCX,
                DocumentFormat.PDF
            ],
            [DocumentFormat.HTML]: [
                DocumentFormat.TEXT,
                DocumentFormat.MARKDOWN,
                DocumentFormat.DOCX,
                DocumentFormat.PDF
            ],
            [DocumentFormat.DOCX]: [
                DocumentFormat.TEXT,
                DocumentFormat.MARKDOWN,
                DocumentFormat.HTML,
                DocumentFormat.PDF
            ],
            [DocumentFormat.PDF]: [
                DocumentFormat.TEXT,
                DocumentFormat.MARKDOWN,
                DocumentFormat.HTML,
                DocumentFormat.DOCX
            ]
        };
        
        return availableConversions[sourceFormat] || [];
    }
    
    /**
     * Enhance HTML preview with interactive features
     * @param html HTML content
     * @param options Preview options
     * @returns Enhanced HTML
     */
    private _enhanceHtmlPreview(html: string, options: PreviewOptions): string {
        let enhanced = html;
        
        // Add class to body for styling
        if (enhanced.includes('<body>')) {
            enhanced = enhanced.replace('<body>', '<body class="vscode-preview-enhance">');
        }
        
        // Add libraries based on options
        const headAdditions: string[] = [];
        const bodyAdditions: string[] = [];
        
        // Add math rendering (KaTeX)
        if (options.renderMath) {
            headAdditions.push(`
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/contrib/auto-render.min.js"></script>
`);
            bodyAdditions.push(`
<script>
    document.addEventListener("DOMContentLoaded", function() {
        renderMathInElement(document.body, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ]
        });
    });
</script>
`);
        }
        
        // Add diagram rendering (Mermaid)
        if (options.renderDiagrams) {
            headAdditions.push(`
<script src="https://cdn.jsdelivr.net/npm/mermaid@9.1.7/dist/mermaid.min.js"></script>
`);
            bodyAdditions.push(`
<script>
    document.addEventListener("DOMContentLoaded", function() {
        mermaid.initialize({
            startOnLoad: true,
            theme: document.body.classList.contains('vscode-dark') ? 'dark' : 'default'
        });
    });
</script>
`);
        }
        
        // Add syntax highlighting (Highlight.js)
        if (options.highlightSyntax) {
            headAdditions.push(`
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.5.0/build/styles/github.min.css">
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.5.0/build/highlight.min.js"></script>
`);
            bodyAdditions.push(`
<script>
    document.addEventListener("DOMContentLoaded", function() {
        document.querySelectorAll('pre code').forEach((el) => {
            hljs.highlightElement(el);
        });
    });
</script>
`);
        }
        
        // Add head content
        if (headAdditions.length > 0) {
            if (enhanced.includes('</head>')) {
                enhanced = enhanced.replace('</head>', headAdditions.join('') + '</head>');
            } else if (enhanced.includes('<body>')) {
                enhanced = enhanced.replace('<body>', '<head>' + headAdditions.join('') + '</head><body>');
            } else {
                enhanced = '<head>' + headAdditions.join('') + '</head>' + enhanced;
            }
        }
        
        // Add body content
        if (bodyAdditions.length > 0) {
            if (enhanced.includes('</body>')) {
                enhanced = enhanced.replace('</body>', bodyAdditions.join('') + '</body>');
            } else {
                enhanced = enhanced + bodyAdditions.join('');
            }
        }
        
        return enhanced;
    }
    
    /**
     * Create error preview
     * @param error Error that occurred
     * @returns HTML error preview
     */
    private _createErrorPreview(error: unknown): string {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return `
<div class="error-preview">
    <h2>Error Generating Preview</h2>
    <div class="error-message">
        ${errorMessage}
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
`;
    }
    
    /**
     * Get file extension for a format
     * @param format Document format
     * @returns File extension with dot
     */
    public static getFileExtension(format: DocumentFormat): string {
        switch (format) {
            case DocumentFormat.MARKDOWN:
                return '.md';
            case DocumentFormat.HTML:
                return '.html';
            case DocumentFormat.TEXT:
                return '.txt';
            case DocumentFormat.DOCX:
                return '.docx';
            case DocumentFormat.PDF:
                return '.pdf';
            default:
                return '.txt';
        }
    }
    
    /**
     * Get format description
     * @param format Document format
     * @returns Human-readable format description
     */
    public static getFormatDescription(format: DocumentFormat): string {
        switch (format) {
            case DocumentFormat.MARKDOWN:
                return 'Markdown';
            case DocumentFormat.HTML:
                return 'HTML';
            case DocumentFormat.TEXT:
                return 'Plain Text';
            case DocumentFormat.DOCX:
                return 'Word Document';
            case DocumentFormat.PDF:
                return 'PDF Document';
            default:
                return 'Unknown Format';
        }
    }
    
    /**
     * Get content type for a format
     * @param format Document format
     * @returns MIME content type
     */
    public static getContentType(format: DocumentFormat): string {
        switch (format) {
            case DocumentFormat.MARKDOWN:
                return 'text/markdown';
            case DocumentFormat.HTML:
                return 'text/html';
            case DocumentFormat.TEXT:
                return 'text/plain';
            case DocumentFormat.DOCX:
                return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            case DocumentFormat.PDF:
                return 'application/pdf';
            default:
                return 'text/plain';
        }
    }
}
