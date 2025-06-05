import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { DocumentFormat } from '../models/documentFormat';
import { SecurityManager } from './securityManager';
import { PathSafetyUtils } from './pathSafetyUtils';
import { FormatConversionOptions } from './formatConverter';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * Preview options for document rendering
 */
export interface PreviewOptions {
    /**
     * Whether the preview should be interactive
     */
    interactive: boolean;
    
    /**
     * Whether to render mathematical expressions
     */
    renderMath: boolean;
    
    /**
     * Whether to render diagrams (mermaid, etc.)
     */
    renderDiagrams: boolean;
    
    /**
     * Whether to highlight syntax in code blocks
     */
    highlightSyntax: boolean;
    
    /**
     * Whether to show annotations in the document
     */
    showAnnotations: boolean;
}

/**
 * Options for document preview generation
 */
export interface DocumentPreviewOptions {
    /**
     * The target format for the preview
     */
    targetFormat: DocumentFormat;
    
    /**
     * Preview rendering options
     */
    preview: PreviewOptions;
    
    /**
     * Whether to preserve original formatting when converting
     */
    preserveFormatting?: boolean;
    
    /**
     * Whether to include styles in the output
     */
    includeStyles?: boolean;
}

/**
 * Options for document export
 */
export interface DocumentExportOptions {
    /**
     * The output file path
     */
    outputPath: string;
    
    /**
     * Whether to open the document after export
     */
    openAfterExport?: boolean;
    
    /**
     * Whether to preserve original formatting when converting
     */
    preserveFormatting?: boolean;
    
    /**
     * Whether to include styles in the output
     */
    includeStyles?: boolean;
}

/**
 * Result of a document export operation
 */
export interface DocumentExportResult {
    /**
     * Whether the export was successful
     */
    success: boolean;
    
    /**
     * The path to the exported file
     */
    filePath?: string;
    
    /**
     * Error message if export failed
     */
    error?: string;
}

/**
 * Result of a format detection operation
 */
export interface FormatDetectionResult {
    /**
     * The detected format
     */
    format: DocumentFormat;
    
    /**
     * Confidence level of the detection (0-1)
     */
    confidence: number;
}

/**
 * Utility class for converting between document formats
 * and generating previews for different document types.
 */
export class DocumentFormatConverter {
    private _securityManager: SecurityManager;
    private _pathSafetyUtils: PathSafetyUtils;
    
    /**
     * Constructor
     * @param context The extension context
     */
    constructor(context?: vscode.ExtensionContext) {
        // Initialize SecurityManager with the context parameter
        if (context) {
            this._securityManager = new SecurityManager(context);
        } else {
            // For testing purposes, we'll create a minimal mock implementation
            // that doesn't use the actual extension context
            this._securityManager = new SecurityManager({} as vscode.ExtensionContext);
        }
        this._pathSafetyUtils = new PathSafetyUtils(this._securityManager);
    }
    
    /**
     * Generate a preview of the document in the target format
     * @param content The document content
     * @param sourceFormat The source format
     * @param options Preview options
     * @returns The preview content
     */
    public async generatePreview(
        content: string,
        sourceFormat: DocumentFormat,
        options: DocumentPreviewOptions
    ): Promise<string> {
        try {
            // If source and target formats are the same, no conversion needed
            if (sourceFormat === options.targetFormat) {
                return this._enhancePreview(content, sourceFormat, options.preview || { 
                    interactive: false,
                    renderMath: false,
                    renderDiagrams: false,
                    highlightSyntax: true,
                    showAnnotations: false
                });
            }
            
            // Convert to target format
            const convertedContent = await this._convertFormat(
                content,
                sourceFormat,
                options.targetFormat,
                options.preserveFormatting ?? true
            );
            
            // Enhance the preview
            return this._enhancePreview(convertedContent, options.targetFormat, options.preview || {
                interactive: false,
                renderMath: false,
                renderDiagrams: false,
                highlightSyntax: true,
                showAnnotations: false
            });
        } catch (error) {
            console.error('Error generating preview:', error);
            throw new Error(`Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Export the document to a file
     * @param content The document content
     * @param sourceFormat The source format
     * @param targetFormat The target format
     * @param options Export options
     * @returns Export result
     */
    public async exportToFile(
        content: string,
        sourceFormat: DocumentFormat,
        targetFormat: DocumentFormat,
        options: DocumentExportOptions
    ): Promise<DocumentExportResult> {
        try {
            // Validate output path
            const validPath = this._pathSafetyUtils.resolveDocumentPath(options.outputPath, "export");
            if (!validPath) {
                return {
                    success: false,
                    error: 'Invalid export path'
                };
            }
            
            // Convert to target format
            const convertedContent = await this._convertFormat(
                content,
                sourceFormat,
                targetFormat,
                options.preserveFormatting ?? true
            );
            
            // Write to file
            await writeFile(validPath, convertedContent);
            
            // Open file if requested
            if (options.openAfterExport) {
                await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(validPath));
            }
            
            return {
                success: true,
                filePath: validPath
            };
        } catch (error) {
            console.error('Error exporting document:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    
    /**
     * Detect the format of the document content
     * @param content The document content
     * @param fileName Optional file name for context
     * @returns Format detection result
     */
    public detectFormat(content: string, fileName?: string): FormatDetectionResult {
        // Ensure content is a string
        if (content === null || content === undefined) {
            content = "";
        }
        
        // Try to detect from file extension first
        if (fileName) {
            const extension = path.extname(fileName).toLowerCase();
            
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
        
        // Try to detect from content
        const contentSample = content.slice(0, 1000).toLowerCase();
        
        // Check for HTML
        if (contentSample.includes('<!doctype html>') || contentSample.includes('<html') || 
            (contentSample.includes('<body') && contentSample.includes('</body>'))) {
            return { format: DocumentFormat.HTML, confidence: 0.8 };
        }
        
        // Check for Markdown
        if (contentSample.includes('# ') || contentSample.includes('## ') || 
            contentSample.includes('```') || contentSample.includes('![') ||
            contentSample.includes('[](') || contentSample.match(/\*\*.+\*\*/)) {
            return { format: DocumentFormat.MARKDOWN, confidence: 0.7 };
        }
        
        // Check for PDF (binary format starts with %PDF)
        if (content.startsWith('%PDF')) {
            return { format: DocumentFormat.PDF, confidence: 0.9 };
        }
        
        // Check for DOCX (binary format, cannot reliably detect from content)
        // If it's binary content that doesn't match PDF, assume it might be DOCX
        if (/[\x00-\x08\x0E-\x1F\x80-\xFF]/.test(contentSample)) {
            return { format: DocumentFormat.DOCX, confidence: 0.3 };
        }
        
        // Default to plain text
        return { format: DocumentFormat.TEXT, confidence: 0.5 };
    }
    
    /**
     * Convert content from one format to another
     * @param content The content to convert
     * @param sourceFormat The source format
     * @param targetFormat The target format
     * @param preserveFormatting Whether to preserve formatting
     * @returns The converted content
     */
    private async _convertFormat(
        content: string,
        sourceFormat: DocumentFormat,
        targetFormat: DocumentFormat,
        preserveFormatting: boolean
    ): Promise<string> {
        // Implement conversion logic for each format pair
        if (sourceFormat === targetFormat) {
            return content;
        }
        
        // Markdown to HTML
        if (sourceFormat === DocumentFormat.MARKDOWN && targetFormat === DocumentFormat.HTML) {
            return this._markdownToHtml(content, preserveFormatting);
        }
        
        // HTML to Markdown
        if (sourceFormat === DocumentFormat.HTML && targetFormat === DocumentFormat.MARKDOWN) {
            return this._htmlToMarkdown(content, preserveFormatting);
        }
        
        // Markdown to Text
        if (sourceFormat === DocumentFormat.MARKDOWN && targetFormat === DocumentFormat.TEXT) {
            return this._stripMarkdown(content);
        }
        
        // HTML to Text
        if (sourceFormat === DocumentFormat.HTML && targetFormat === DocumentFormat.TEXT) {
            return this._stripHtml(content);
        }
        
        // For other conversions, default to simple content pass-through
        // In a real implementation, these would be implemented with proper conversion libraries
        console.warn(`Conversion from ${DocumentFormat[sourceFormat]} to ${DocumentFormat[targetFormat]} not fully implemented`);
        return content;
    }
    
    /**
     * Convert Markdown to HTML
     * @param markdown The Markdown content
     * @param preserveFormatting Whether to preserve formatting
     * @returns The HTML content
     */
    private _markdownToHtml(markdown: string, preserveFormatting: boolean | FormatConversionOptions): string {
        // If preserveFormatting is an object, extract the boolean value
        if (typeof preserveFormatting === 'object') {
            preserveFormatting = preserveFormatting.preserveFormatting ?? true;
        }
        // In a full implementation, we would use a Markdown parser
        // For now, implement a simple conversion with regex
        
        // Convert headings
        let html = markdown
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
            .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
            .replace(/^###### (.*$)/gm, '<h6>$1</h6>');
        
        // Convert bold and italic
        html = html
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>');
        
        // Convert links
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
        
        // Convert images
        html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');
        
        // Convert code blocks
        html = html.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        
        // Convert inline code
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Convert unordered lists
        html = html.replace(/^\s*[-*+]\s+(.*$)/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>');
        
        // Convert ordered lists
        html = html.replace(/^\s*\d+\.\s+(.*$)/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n)+/g, '<ol>$&</ol>');
        
        // Convert paragraphs (any line that doesn't match the above)
        html = html.replace(/^([^<].*$)/gm, '<p>$1</p>');
        
        // Convert line breaks
        html = html.replace(/\n\n/g, '</p><p>');
        
        // Wrap in HTML document
        if (preserveFormatting) {
            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Converted Document</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        
        pre {
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        
        code {
            font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
            background-color: #f5f5f5;
            padding: 2px 4px;
            border-radius: 3px;
        }
        
        pre code {
            padding: 0;
            background-color: transparent;
        }
        
        img {
            max-width: 100%;
            height: auto;
        }
    </style>
</head>
<body>
    ${html}
</body>
</html>`;
        } else {
            return html;
        }
    }
    
    /**
     * Convert HTML to Markdown
     * @param html The HTML content
     * @param preserveFormatting Whether to preserve formatting
     * @returns The Markdown content
     */
    private _htmlToMarkdown(html: string, _preserveFormatting: boolean): string {
        // In a full implementation, we would use an HTML to Markdown converter
        // This is a simplified implementation for demo purposes
        
        // Replace headings
        let markdown = html
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
            .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
            .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
            .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
        
        // Replace paragraphs
        markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
        
        // Replace bold and italic
        markdown = markdown
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
            .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
            .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
        
        // Replace links
        markdown = markdown.replace(/<a[^>]*href="(.*?)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
        
        // Replace images
        markdown = markdown.replace(/<img[^>]*src="(.*?)"[^>]*alt="(.*?)"[^>]*\/?>/gi, '![$2]($1)');
        
        // Replace code blocks
        markdown = markdown.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
        
        // Replace inline code
        markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
        
        // Replace lists
        markdown = markdown
            .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, function(_match: string, content: string) {
                return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
            })
            .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, function(_match: string, content: string) {
                let index = 1;
                return content.replace(/<li[^>]*>(.*?)<\/li>/gi, function(_m: string, item: string) {
                    return `${index++}. ${item}\n`;
                }) + '\n';
            });
        
        // Clean up HTML tags
        markdown = markdown.replace(/<[^>]+>/g, '');
        
        // Clean up extra whitespace
        markdown = markdown.replace(/\n{3,}/g, '\n\n');
        
        return markdown.trim();
    }
    
    /**
     * Strip formatting from Markdown
     * @param markdown Markdown content
     * @returns Plain text content
     */
    private _stripMarkdown(markdown: string): string {
        // Remove headings
        let text = markdown
            .replace(/^#+\s+(.*$)/gm, '$1\n')
            
            // Remove bold and italic
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/_(.*?)_/g, '$1')
            
            // Remove links but keep link text
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            
            // Remove images
            .replace(/!\[.*?\]\(.*?\)/g, '')
            
            // Remove code blocks but keep content
            .replace(/```(?:.*?)\n([\s\S]*?)```/g, '$1\n')
            
            // Remove inline code but keep content
            .replace(/`(.*?)`/g, '$1');
        
        return text;
    }
    
    /**
     * Strip HTML tags from content
     * @param html HTML content
     * @returns Plain text content
     */
    private _stripHtml(html: string): string {
        // Simple HTML tag removal
        return html
            // Remove all HTML tags
            .replace(/<[^>]+>/g, '')
            
            // Fix spacing
            .replace(/\s+/g, ' ')
            
            // Add paragraph breaks
            .replace(/<\/p>\s*<p>/gi, '\n\n')
            
            // Clean up
            .trim();
    }
    
    /**
     * Enhance preview with additional features
     * @param content Content to enhance
     * @param format Content format
     * @param options Preview options
     * @returns Enhanced preview content
     */
    private _enhancePreview(content: string, format: DocumentFormat, options: PreviewOptions): string {
        if (!options) {
            options = {
                interactive: false,
                renderMath: false,
                renderDiagrams: false,
                highlightSyntax: true,
                showAnnotations: false
            };
        }
        
        // Start with the original content
        let enhancedContent = content;
        
        // Apply enhancements based on format
        if (format === DocumentFormat.HTML) {
            // For HTML, we can directly add enhancement scripts
            
            // Add math rendering if enabled
            if (options.renderMath) {
                enhancedContent = this._addMathSupport(enhancedContent);
            }
            
            // Add diagram rendering if enabled
            if (options.renderDiagrams) {
                enhancedContent = this._addDiagramSupport(enhancedContent);
            }
            
            // Add syntax highlighting if enabled
            if (options.highlightSyntax) {
                enhancedContent = this._addSyntaxHighlighting(enhancedContent);
            }
            
            // Add annotation support if enabled
            if (options.showAnnotations) {
                enhancedContent = this._addAnnotationSupport(enhancedContent);
            }
            
        } else if (format === DocumentFormat.MARKDOWN) {
            // For Markdown, we need to convert to HTML first to add enhancements
            enhancedContent = this._markdownToHtml(enhancedContent, true);
            
            return this._enhancePreview(enhancedContent, DocumentFormat.HTML, options);
        } else if (format === DocumentFormat.TEXT) {
            // For plain text, convert to HTML for preview
            enhancedContent = `<pre>${enhancedContent}</pre>`;
            return enhancedContent;
        }
        
        return enhancedContent;
    }
    
    /**
     * Add math rendering support to HTML content
     * @param html HTML content
     * @returns HTML with math support
     */
    private _addMathSupport(html: string): string {
        // Add MathJax support
        const mathJaxScript = `
<script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
<script>
    window.MathJax = {
        tex: {
            inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
            displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
            processEscapes: true
        }
    };
</script>`;
        
        // Insert before closing head tag
        return html.replace('</head>', `${mathJaxScript}\n</head>`);
    }
    
    /**
     * Add diagram rendering support to HTML content
     * @param html HTML content
     * @returns HTML with diagram support
     */
    private _addDiagramSupport(html: string): string {
        // Add Mermaid.js support
        const mermaidScript = `
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        mermaid.initialize({ startOnLoad: true });
    });
</script>`;
        
        // Insert before closing head tag
        return html.replace('</head>', `${mermaidScript}\n</head>`);
    }
    
    /**
     * Add syntax highlighting to HTML content
     * @param html HTML content
     * @returns HTML with syntax highlighting
     */
    private _addSyntaxHighlighting(html: string): string {
        // Add highlight.js support
        const highlightScript = `
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/default.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"></script>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    });
</script>`;
        
        // Insert before closing head tag
        return html.replace('</head>', `${highlightScript}\n</head>`);
    }
    
    /**
     * Add annotation support to HTML content
     * @param html HTML content
     * @returns HTML with annotation support
     */
    private _addAnnotationSupport(html: string): string {
        // Add custom annotation styling and script
        const annotationSupport = `
<style>
    .annotation {
        background-color: #fff3cd;
        padding: 10px;
        margin: 10px 0;
        border-left: 4px solid #ffc107;
        border-radius: 4px;
    }
    .annotation-marker {
        cursor: pointer;
        background-color: #ffc107;
        padding: 2px 4px;
        border-radius: 3px;
    }
</style>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.annotation-marker').forEach(marker => {
            marker.addEventListener('click', () => {
                const targetId = marker.getAttribute('data-target');
                const target = document.getElementById(targetId);
                if (target) {
                    target.style.display = target.style.display === 'none' ? 'block' : 'none';
                }
            });
        });
    });
</script>`;
        
        // Insert before closing head tag
        return html.replace('</head>', `${annotationSupport}\n</head>`);
    }
}
