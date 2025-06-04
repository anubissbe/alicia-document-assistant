import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { FormatProcessor } from '../core/formatProcessor';
import { DocumentFormat } from '../models/documentFormat';
import { DocumentService } from '../services/documentService';
import { PathSafetyUtils } from './pathSafetyUtils';

// Promisify fs functions
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

/**
 * Export options interface
 */
export interface ExportOptions {
    /**
     * Output file path
     */
    outputPath?: string;
    
    /**
     * Target format
     */
    targetFormat: DocumentFormat;
    
    /**
     * Include styles
     */
    includeStyles?: boolean;
    
    /**
     * Custom styles
     */
    customStyles?: Record<string, string>;
    
    /**
     * Custom template path
     */
    templatePath?: string;
    
    /**
     * Document metadata
     */
    metadata?: Record<string, any>;
    
    /**
     * Open after export
     */
    openAfterExport?: boolean;
    
    /**
     * Force overwrite if file exists
     */
    forceOverwrite?: boolean;
}

/**
 * Export result interface
 */
export interface ExportResult {
    /**
     * Whether the export was successful
     */
    success: boolean;
    
    /**
     * The output path if successful
     */
    outputPath?: string;
    
    /**
     * Error message if unsuccessful
     */
    error?: string;
    
    /**
     * Export format
     */
    format?: DocumentFormat;
    
    /**
     * Original file path
     */
    originalPath?: string;
}

/**
 * Utility functions for exporting documents to different formats
 */
export class ExportUtils {
    /**
     * Export a document to a specified format
     * @param content Document content to export
     * @param sourceFormat Source format of content
     * @param options Export options
     * @returns Promise resolving to export result
     */
    public static async exportContent(
        content: string,
        sourceFormat: DocumentFormat,
        options: ExportOptions
    ): Promise<ExportResult> {
        try {
            // Validate content
            if (!content) {
                return {
                    success: false,
                    error: 'No content provided for export'
                };
            }
            
            // Ensure security checks on output path
            if (options.outputPath) {
                // Perform basic path safety checks directly
                // Check for path traversal
                if (options.outputPath.includes('..')) {
                    return {
                        success: false,
                        error: 'Invalid output path. Path traversal detected.'
                    };
                }
                
                // Check for absolute paths outside workspace
                if (path.isAbsolute(options.outputPath)) {
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (!workspaceFolders) {
                        return {
                            success: false,
                            error: 'Invalid output path. Absolute paths require an open workspace.'
                        };
                    }
                    
                    // Verify path is within a workspace folder
                    const isInWorkspace = workspaceFolders.some(folder => 
                        options.outputPath!.startsWith(folder.uri.fsPath)
                    );
                    
                    if (!isInWorkspace) {
                        return {
                            success: false,
                            error: 'Invalid output path. Path must be within the workspace.'
                        };
                    }
                }
                
                // Additional extension validation
                const allowedExtensions = ['.txt', '.md', '.html', '.docx', '.pdf'];
                const fileExt = path.extname(options.outputPath).toLowerCase();
                if (!allowedExtensions.includes(fileExt)) {
                    return {
                        success: false,
                        error: `Invalid file extension. Allowed extensions: ${allowedExtensions.join(', ')}`
                    };
                }
            }
            
            // Determine output path if not provided
            const outputPath = options.outputPath || this._generateDefaultOutputPath(options.targetFormat);
            
            // Create directory if it doesn't exist
            const dirPath = path.dirname(outputPath);
            if (!await exists(dirPath)) {
                await mkdir(dirPath, { recursive: true });
            }
            
            // Check if file exists and handle overwrite
            if (await exists(outputPath) && !options.forceOverwrite) {
                const overwrite = await vscode.window.showWarningMessage(
                    `File ${path.basename(outputPath)} already exists. Overwrite?`,
                    'Yes',
                    'No'
                );
                
                if (overwrite !== 'Yes') {
                    return {
                        success: false,
                        error: 'Export cancelled by user'
                    };
                }
            }
            
            // Process content using FormatProcessor
            const formatProcessor = new FormatProcessor();
            const processedContent = await formatProcessor.processContent(
                content,
                sourceFormat,
                options.targetFormat,
                {
                    includeStyles: options.includeStyles,
                    customStyles: options.customStyles,
                    templatePath: options.templatePath,
                    metadata: options.metadata,
                    outputPath: outputPath
                }
            );
            
            // Write processed content to file
            await writeFile(outputPath, processedContent);
            
            // Open file if requested
            if (options.openAfterExport) {
                await this._openExportedFile(outputPath, options.targetFormat);
            }
            
            return {
                success: true,
                outputPath,
                format: options.targetFormat,
                originalPath: options.outputPath
            };
        } catch (error) {
            console.error('Export error:', error);
            return {
                success: false,
                error: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    
    /**
     * Generate a preview for a document in a specified format
     * @param content Document content to preview
     * @param sourceFormat Source format of content
     * @param targetFormat Target format for preview
     * @param options Preview options
     * @returns Preview content
     */
    public static async generatePreview(
        content: string,
        sourceFormat: DocumentFormat,
        targetFormat: DocumentFormat,
        options: { 
            includeStyles?: boolean; 
            customStyles?: Record<string, string>;
            templatePath?: string;
            preserveImages?: boolean;
            imageBasePath?: string;
            interactive?: boolean;
            renderMath?: boolean;
            renderDiagrams?: boolean;
            highlightSyntax?: boolean;
            showAnnotations?: boolean;
        } = {}
    ): Promise<string> {
        try {
            // Process content using FormatProcessor
            const formatProcessor = new FormatProcessor();
            const processedContent = await formatProcessor.processContent(
                content,
                sourceFormat,
                targetFormat,
                {
                    includeStyles: options.includeStyles !== false, // Default to true
                    customStyles: options.customStyles,
                    templatePath: options.templatePath,
                    preserveImages: options.preserveImages,
                    imageBasePath: options.imageBasePath
                }
            );
            
            // Apply additional enhancements for previews
            return this._enhancePreviewContent(
                processedContent, 
                targetFormat, 
                {
                    interactive: options.interactive,
                    renderMath: options.renderMath,
                    renderDiagrams: options.renderDiagrams,
                    highlightSyntax: options.highlightSyntax,
                    showAnnotations: options.showAnnotations
                }
            );
        } catch (error) {
            console.error('Preview generation error:', error);
            return `Error generating preview: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
    
    /**
     * Enhance preview content with additional features
     * @param content The base preview content
     * @param format The document format
     * @param options Enhancement options
     * @returns Enhanced preview content
     */
    private static _enhancePreviewContent(
        content: string,
        format: DocumentFormat,
        options: {
            interactive?: boolean;
            renderMath?: boolean;
            renderDiagrams?: boolean;
            highlightSyntax?: boolean;
            showAnnotations?: boolean;
        } = {}
    ): string {
        // For formats other than HTML, return as is
        if (format !== DocumentFormat.HTML) {
            return content;
        }
        
        try {
            // Parse the HTML content
            let enhancedContent = content;
            
            // Add syntax highlighting for code blocks if enabled
            if (options.highlightSyntax) {
                enhancedContent = this._addSyntaxHighlighting(enhancedContent);
            }
            
            // Add math rendering if enabled
            if (options.renderMath) {
                enhancedContent = this._addMathRendering(enhancedContent);
            }
            
            // Add diagram rendering if enabled
            if (options.renderDiagrams) {
                enhancedContent = this._addDiagramRendering(enhancedContent);
            }
            
            // Add interactive elements if enabled
            if (options.interactive) {
                enhancedContent = this._addInteractiveElements(enhancedContent);
            }
            
            // Add annotation support if enabled
            if (options.showAnnotations) {
                enhancedContent = this._addAnnotationSupport(enhancedContent);
            }
            
            return enhancedContent;
        } catch (error) {
            console.error('Error enhancing preview content:', error);
            return content; // Return original content on error
        }
    }
    
    /**
     * Add syntax highlighting to HTML content
     * @param content HTML content
     * @returns HTML content with syntax highlighting
     */
    private static _addSyntaxHighlighting(content: string): string {
        // Look for <pre><code> blocks
        const codeBlockRegex = /<pre><code(?:\s+class="language-(\w+)")?>([^<]+)<\/code><\/pre>/g;
        
        // Replace with highlighted code
        return content.replace(codeBlockRegex, (match, language, code) => {
            // Insert CSS class for highlighting
            const langClass = language ? ` class="language-${language} hljs"` : ' class="hljs"';
            
            // Return modified code block
            return `<pre><code${langClass}>${code}</code></pre>`;
        });
    }
    
    /**
     * Add math rendering to HTML content
     * @param content HTML content
     * @returns HTML content with math rendering
     */
    private static _addMathRendering(content: string): string {
        // Add MathJax scripts if not already present
        if (!content.includes('mathjax')) {
            const mathScript = `
<script>
    window.MathJax = {
        tex: {
            inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
            displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
            processEscapes: true
        },
        svg: {
            fontCache: 'global'
        }
    };
</script>
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
`;
            
            // Insert before closing head tag
            if (content.includes('</head>')) {
                return content.replace('</head>', `${mathScript}</head>`);
            } else if (content.includes('<body>')) {
                // If no head tag, insert before body
                return content.replace('<body>', `<head>${mathScript}</head><body>`);
            } else {
                // If neither, append to the start
                return `<html><head>${mathScript}</head><body>${content}</body></html>`;
            }
        }
        
        return content;
    }
    
    /**
     * Add diagram rendering to HTML content
     * @param content HTML content
     * @returns HTML content with diagram rendering
     */
    private static _addDiagramRendering(content: string): string {
        // Add Mermaid script if not already present
        if (!content.includes('mermaid.min.js') && content.includes('```mermaid')) {
            const mermaidScript = `
<script src="https://cdn.jsdelivr.net/npm/mermaid@9/dist/mermaid.min.js"></script>
<script>
    document.addEventListener('DOMContentLoaded', function() {
        mermaid.initialize({ startOnLoad: true });
    });
</script>
`;
            
            // Insert before closing head tag
            if (content.includes('</head>')) {
                return content.replace('</head>', `${mermaidScript}</head>`);
            } else if (content.includes('<body>')) {
                // If no head tag, insert before body
                return content.replace('<body>', `<head>${mermaidScript}</head><body>`);
            } else {
                // If neither, append to the start
                return `<html><head>${mermaidScript}</head><body>${content}</body></html>`;
            }
        }
        
        // Look for mermaid code blocks and convert them to div elements
        const mermaidBlockRegex = /<pre><code class="language-mermaid">([^<]+)<\/code><\/pre>/g;
        return content.replace(mermaidBlockRegex, '<div class="mermaid">$1</div>');
    }
    
    /**
     * Add interactive elements to HTML content
     * @param content HTML content
     * @returns HTML content with interactive elements
     */
    private static _addInteractiveElements(content: string): string {
        // Add interactivity script if not already present
        const interactivityScript = `
<script>
    document.addEventListener('DOMContentLoaded', function() {
        // Make tables sortable
        document.querySelectorAll('table').forEach(table => {
            table.classList.add('sortable');
            const headers = table.querySelectorAll('th');
            headers.forEach(header => {
                header.addEventListener('click', function() {
                    const index = Array.from(header.parentElement.children).indexOf(header);
                    sortTable(table, index);
                });
                header.style.cursor = 'pointer';
                header.title = 'Click to sort';
            });
        });
        
        // Add expand/collapse to all details elements
        document.querySelectorAll('details').forEach(details => {
            details.addEventListener('toggle', function() {
                localStorage.setItem('details-' + this.id, this.open);
            });
            const stored = localStorage.getItem('details-' + details.id);
            if (stored === 'true') {
                details.open = true;
            }
        });
        
        // Function to sort table
        function sortTable(table, column) {
            const tbody = table.querySelector('tbody') || table;
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const header = table.querySelectorAll('th')[column];
            const isAscending = header.classList.contains('sort-asc');
            
            // Update header classes
            table.querySelectorAll('th').forEach(th => {
                th.classList.remove('sort-asc', 'sort-desc');
            });
            
            header.classList.add(isAscending ? 'sort-desc' : 'sort-asc');
            
            // Sort the rows
            rows.sort((a, b) => {
                const aValue = a.querySelectorAll('td')[column]?.textContent || '';
                const bValue = b.querySelectorAll('td')[column]?.textContent || '';
                
                // Try numeric sort if possible
                const aNum = parseFloat(aValue);
                const bNum = parseFloat(bValue);
                
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return isAscending ? bNum - aNum : aNum - bNum;
                }
                
                // Fall back to string sort
                return isAscending ? 
                    bValue.localeCompare(aValue) : 
                    aValue.localeCompare(bValue);
            });
            
            // Reorder the rows
            rows.forEach(row => tbody.appendChild(row));
        }
    });
</script>
<style>
    table.sortable th {
        position: relative;
    }
    table.sortable th:after {
        content: ' ';
        position: absolute;
        right: 5px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
    }
    table.sortable th.sort-asc:after {
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-bottom: 5px solid currentColor;
    }
    table.sortable th.sort-desc:after {
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 5px solid currentColor;
    }
</style>
`;
        
        // Insert before closing body tag
        if (content.includes('</body>')) {
            return content.replace('</body>', `${interactivityScript}</body>`);
        } else {
            // If no body tag, append to the end
            return `${content}${interactivityScript}`;
        }
    }
    
    /**
     * Add annotation support to HTML content
     * @param content HTML content
     * @returns HTML content with annotation support
     */
    private static _addAnnotationSupport(content: string): string {
        // Add annotation styles and scripts
        const annotationScript = `
<style>
    .annotatable {
        position: relative;
    }
    .annotation-marker {
        display: inline-block;
        background-color: rgba(255, 255, 0, 0.3);
        cursor: pointer;
    }
    .annotation-popup {
        position: absolute;
        background: white;
        border: 1px solid #ccc;
        padding: 10px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 1000;
        max-width: 300px;
        display: none;
    }
    .annotation-popup.visible {
        display: block;
    }
    .annotation-list {
        margin-top: 20px;
        border-top: 1px solid #eee;
        padding-top: 20px;
    }
    .annotation-item {
        margin-bottom: 10px;
        padding: 10px;
        background-color: #f8f8f8;
        border-radius: 4px;
    }
</style>
<script>
    document.addEventListener('DOMContentLoaded', function() {
        // Make document content annotatable
        document.querySelector('.preview-content').classList.add('annotatable');
        
        // Add annotation panel if not exists
        if (!document.querySelector('.annotation-list')) {
            const annotationList = document.createElement('div');
            annotationList.className = 'annotation-list';
            annotationList.innerHTML = '<h3>Annotations</h3><div class="annotation-items"></div>';
            document.querySelector('.preview-content').after(annotationList);
        }
        
        // Load existing annotations
        const annotations = JSON.parse(localStorage.getItem('document-annotations') || '[]');
        
        // Display existing annotations
        annotations.forEach(function(annotation) {
            addAnnotationMarker(annotation);
            addAnnotationToList(annotation);
        });
        
        // Function to add annotation marker
        function addAnnotationMarker(annotation) {
            const startNode = document.querySelector('[data-annotation-id="' + annotation.id + '"]');
            
            if (startNode) {
                const marker = document.createElement('span');
                marker.className = 'annotation-marker';
                marker.setAttribute('data-annotation-id', annotation.id);
                marker.textContent = startNode.textContent;
                marker.title = 'Click to view annotation';
                
                startNode.parentNode.replaceChild(marker, startNode);
                
                marker.addEventListener('click', function(e) {
                    showAnnotationPopup(annotation, e.target);
                });
            }
        }
        
        // Function to show annotation popup
        function showAnnotationPopup(annotation, target) {
            let popup = document.querySelector('.annotation-popup');
            
            if (!popup) {
                popup = document.createElement('div');
                popup.className = 'annotation-popup';
                document.body.appendChild(popup);
            }
            
            popup.innerHTML = '<div class="annotation-content">' + annotation.content + 
                '</div><div class="annotation-meta"><small>Added: ' + 
                new Date(annotation.timestamp).toLocaleString() + '</small></div>';
            
            // Position popup near the target
            const rect = target.getBoundingClientRect();
            popup.style.left = rect.left + 'px';
            popup.style.top = (rect.bottom + 5) + 'px';
            
            // Show popup
            popup.classList.add('visible');
            
            // Close popup when clicking outside
            document.addEventListener('click', function closePopup(e) {
                if (!popup.contains(e.target) && e.target !== target) {
                    popup.classList.remove('visible');
                    document.removeEventListener('click', closePopup);
                }
            });
        }
        
        // Function to add annotation to list
        function addAnnotationToList(annotation) {
            const annotationItems = document.querySelector('.annotation-items');
            const item = document.createElement('div');
            item.className = 'annotation-item';
            item.setAttribute('data-annotation-id', annotation.id);
            
            item.innerHTML = '<div class="annotation-content">' + annotation.content + 
                '</div><div class="annotation-meta"><small>Added: ' + 
                new Date(annotation.timestamp).toLocaleString() + '</small></div>';
            
            annotationItems.appendChild(item);
            
            // Scroll to annotation when clicking on list item
            item.addEventListener('click', function() {
                const marker = document.querySelector('.annotation-marker[data-annotation-id="' + annotation.id + '"]');
                if (marker) {
                    marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    marker.style.backgroundColor = 'rgba(255, 255, 0, 0.6)';
                    setTimeout(function() {
                        marker.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                    }, 1500);
                }
            });
        }
    });
</script>
`;
        
        // Insert before closing body tag
        if (content.includes('</body>')) {
            return content.replace('</body>', `${annotationScript}</body>`);
        } else {
            // If no body tag, append to the end
            return `${content}${annotationScript}`;
        }
    }
    
    /**
     * Get available export formats for a source format
     * @param sourceFormat Source format
     * @returns Array of available export formats
     */
    public static getAvailableExportFormats(sourceFormat: DocumentFormat): DocumentFormat[] {
        // Define available export formats for each source format
        const exportMap: Record<DocumentFormat, DocumentFormat[]> = {
            [DocumentFormat.TEXT]: [
                DocumentFormat.HTML, 
                DocumentFormat.MARKDOWN, 
                DocumentFormat.DOCX, 
                DocumentFormat.PDF
            ],
            [DocumentFormat.MARKDOWN]: [
                DocumentFormat.HTML, 
                DocumentFormat.TEXT, 
                DocumentFormat.DOCX, 
                DocumentFormat.PDF
            ],
            [DocumentFormat.HTML]: [
                DocumentFormat.MARKDOWN, 
                DocumentFormat.TEXT, 
                DocumentFormat.DOCX, 
                DocumentFormat.PDF
            ],
            [DocumentFormat.DOCX]: [
                DocumentFormat.HTML, 
                DocumentFormat.MARKDOWN, 
                DocumentFormat.TEXT, 
                DocumentFormat.PDF
            ],
            [DocumentFormat.PDF]: [
                DocumentFormat.HTML, 
                DocumentFormat.MARKDOWN, 
                DocumentFormat.TEXT, 
                DocumentFormat.DOCX
            ]
        };
        
        return exportMap[sourceFormat] || [];
    }
    
    /**
     * Get file extension for a document format
     * @param format Document format
     * @returns File extension including the dot
     */
    public static getFileExtension(format: DocumentFormat): string {
        switch (format) {
            case DocumentFormat.TEXT:
                return '.txt';
            case DocumentFormat.MARKDOWN:
                return '.md';
            case DocumentFormat.HTML:
                return '.html';
            case DocumentFormat.DOCX:
                return '.docx';
            case DocumentFormat.PDF:
                return '.pdf';
            default:
                return '.txt';
        }
    }
    
    /**
     * Generate default output path for export
     * @param format Target format
     * @returns Default output path
     */
    private static _generateDefaultOutputPath(format: DocumentFormat): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = this.getFileExtension(format);
        const fileName = `export-${timestamp}${extension}`;
        
        // Use system temp directory
        return path.join(vscode.workspace.rootPath || process.cwd(), 'exports', fileName);
    }
    
    /**
     * Open exported file with appropriate application
     * @param filePath Path to exported file
     * @param format Format of exported file
     */
    private static async _openExportedFile(filePath: string, format: DocumentFormat): Promise<void> {
        try {
            const uri = vscode.Uri.file(filePath);
            
            switch (format) {
                case DocumentFormat.HTML:
                    // Open HTML in default browser
                    await vscode.env.openExternal(uri);
                    break;
                    
                case DocumentFormat.MARKDOWN:
                case DocumentFormat.TEXT:
                    // Open text-based formats in VS Code
                    await vscode.window.showTextDocument(uri);
                    break;
                    
                case DocumentFormat.DOCX:
                case DocumentFormat.PDF:
                    // Open binary formats with system default application
                    await vscode.env.openExternal(uri);
                    break;
            }
        } catch (error) {
            console.error('Error opening exported file:', error);
            vscode.window.showErrorMessage(`Failed to open exported file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Get mime type for a document format
     * @param format Document format
     * @returns Mime type string
     */
    public static getMimeType(format: DocumentFormat): string {
        switch (format) {
            case DocumentFormat.TEXT:
                return 'text/plain';
            case DocumentFormat.MARKDOWN:
                return 'text/markdown';
            case DocumentFormat.HTML:
                return 'text/html';
            case DocumentFormat.DOCX:
                return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            case DocumentFormat.PDF:
                return 'application/pdf';
            default:
                return 'application/octet-stream';
        }
    }
    
    /**
     * Detect format from file path
     * @param filePath File path
     * @returns Detected document format
     */
    public static detectFormatFromPath(filePath: string): DocumentFormat {
        const extension = path.extname(filePath).toLowerCase();
        
        switch (extension) {
            case '.txt':
                return DocumentFormat.TEXT;
            case '.md':
            case '.markdown':
                return DocumentFormat.MARKDOWN;
            case '.html':
            case '.htm':
                return DocumentFormat.HTML;
            case '.docx':
            case '.doc':
                return DocumentFormat.DOCX;
            case '.pdf':
                return DocumentFormat.PDF;
            default:
                return DocumentFormat.TEXT; // Default to text
        }
    }
}
